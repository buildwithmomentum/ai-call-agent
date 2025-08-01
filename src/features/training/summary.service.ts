import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../utils/supabase/supabaseClient';
import { TokenCost, TokenCount } from './training.interface';
import { LLMChain, loadSummarizationChain } from 'langchain/chains';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { Document } from '@langchain/core/documents';
import { encoding_for_model, TiktokenModel } from '@dqbd/tiktoken';
import { PRICING } from '../../utils/constants.util';
import { summaryOptimizerTemplate } from '../../utils/promptTemplates';

@Injectable()
export class SummaryService {
  private readonly supabase;
  private readonly logger = new Logger(SummaryService.name);

  constructor(private readonly supabaseService: SupabaseService) {
    this.supabase = supabaseService.getClient();
  }
  /**
   * Generates a summary and calculates token cost.
   * @returns Summary and token cost.
   */
  public async generateSummary(
    voiceAgentId: string,
    optimizer: boolean = false,
  ): Promise<{ summary: string; tokenCost: TokenCost }> {
    const model = new ChatOpenAI({
      temperature: 0,
      modelName: 'gpt-3.5-turbo',
    });

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 10000,
      chunkOverlap: 500,
    });

    const summarizeChain = loadSummarizationChain(model, {
      type: 'map_reduce',
      verbose: false,
    });

    try {
      const documentContents = await this.fetchDocumentContent(voiceAgentId);
      const combinedContent = documentContents.join('\n\n');
      const { summary: initialSummary, tokenCost: initialTokenCost } =
        await this.recursiveSummarize(
          combinedContent,
          model,
          summarizeChain,
          textSplitter,
        );

      if (optimizer) {
        const { optimizedSummary, tokenCost: optimizationTokenCost } =
          await this.summaryOptimizer(initialSummary);
        return {
          summary: optimizedSummary,
          tokenCost: {
            tokens: {
              input:
                initialTokenCost.tokens.input +
                optimizationTokenCost.tokens.input,
              output:
                initialTokenCost.tokens.output +
                optimizationTokenCost.tokens.output,
            },
            cost: initialTokenCost.cost + optimizationTokenCost.cost,
          },
        };
      }

      return {
        summary: initialSummary,
        tokenCost: initialTokenCost,
      };
    } catch (error) {
      this.logger.error(`Error generating summary: ${error.message}`);
      throw new Error(`Failed to generate summary: ${error.message}`);
    }
  }
  /**
   * Fetches document content from Supabase for a given voice_agent ID.
   */
  private async fetchDocumentContent(voiceAgentId: string): Promise<string[]> {
    const chatId = `zz_${voiceAgentId}`;
    const { data, error } = await this.supabase.from(chatId).select('content');

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to fetch content for voiceAgentId: ${voiceAgentId}`);
    }

    if (!data || data.length === 0)
      throw new Error('No content found for this voice_agent ID');

    return data.map((item) => item.content);
  }
  /**
   * Recursively summarizes large content by splitting into manageable chunks.
   * @returns Summary and token cost.
   */
  private async recursiveSummarize(
    content: string,
    model: ChatOpenAI,
    summarizeChain: any,
    textSplitter: RecursiveCharacterTextSplitter,
    startIndex: number = 0,
  ): Promise<{ summary: string; tokenCost: TokenCost }> {
    const chunks = await textSplitter.createDocuments([content]);
    const totalTokenCost: TokenCost = {
      tokens: { input: 0, output: 0 },
      cost: 0,
    };

    if (chunks.length === 1) {
      const result = await this.summarizeDocuments(
        [chunks[0]],
        model,
        summarizeChain,
      );
      return { summary: result.text, tokenCost: result.tokenCost };
    }

    let summaries = '';
    let currentIndex = startIndex;

    while (currentIndex < chunks.length) {
      const result = await this.summarizeDocuments(
        chunks,
        model,
        summarizeChain,
        currentIndex,
      );
      summaries += result.text;
      currentIndex = result.processedIndex;
      totalTokenCost.tokens.input += result.tokenCost.tokens.input;
      totalTokenCost.tokens.output += result.tokenCost.tokens.output;
      totalTokenCost.cost += result.tokenCost.cost;

      if (currentIndex < chunks.length) {
        console.log(`Waiting before resuming from index ${currentIndex}`);
        await new Promise((resolve) => setTimeout(resolve, 60000));
      }
    }

    if (summaries.length > 24000) {
      const recursiveResult = await this.recursiveSummarize(
        summaries,
        model,
        summarizeChain,
        textSplitter,
      );
      totalTokenCost.tokens.input += recursiveResult.tokenCost.tokens.input;
      totalTokenCost.tokens.output += recursiveResult.tokenCost.tokens.output;
      totalTokenCost.cost += recursiveResult.tokenCost.cost;
      return { summary: recursiveResult.summary, tokenCost: totalTokenCost };
    }

    return { summary: summaries, tokenCost: totalTokenCost };
  }
  /**
   * Optimizes the summary.
   */
  private async summaryOptimizer(
    prev_summary: string,
  ): Promise<{ optimizedSummary: string; tokenCost: TokenCost }> {
    const model = new ChatOpenAI({
      temperature: 0.7,
      modelName: 'gpt-4',
    });

    const promptTemplate = PromptTemplate.fromTemplate(
      summaryOptimizerTemplate,
    );

    const chain = new LLMChain({
      llm: model,
      prompt: promptTemplate,
    });

    try {
      const inputTokens = this.countTokens(prev_summary, model.modelName);
      const result = await chain.call({
        original_summary: prev_summary,
      });
      const outputTokens = this.countTokens(result.text, model.modelName);

      const tokenCost: TokenCost = {
        tokens: { input: inputTokens, output: outputTokens },
        cost: this.calculateCost(
          { input: inputTokens, output: outputTokens },
          model.modelName,
        ),
      };

      return {
        optimizedSummary: result.text,
        tokenCost: tokenCost,
      };
    } catch (error) {
      this.logger.error('Error in summary optimization:', error);
      throw new Error('Failed to optimize summary');
    }
  }
  /**
   * Summarizes a chunk of documents.
   * @returns Summary text, processed index, and token cost.
   */
  private async summarizeDocuments(
    docs: Document[],
    model: ChatOpenAI,
    summarizeChain: any,
    startIndex: number = 0,
  ): Promise<{ text: string; processedIndex: number; tokenCost: TokenCost }> {
    const result = {
      text: '',
      processedIndex: startIndex,
      tokenCost: { tokens: { input: 0, output: 0 }, cost: 0 },
    };
    for (let i = startIndex; i < docs.length; i++) {
      try {
        const inputTokens = this.countTokens(
          docs[i].pageContent,
          model.modelName,
        );
        const chunkResult = await summarizeChain.call({
          input_documents: [docs[i]],
        });
        const outputTokens = this.countTokens(
          chunkResult.text,
          model.modelName,
        );

        result.text += chunkResult.text + '\n\n';
        result.processedIndex = i + 1;
        result.tokenCost.tokens.input += inputTokens;
        result.tokenCost.tokens.output += outputTokens;
      } catch (error: any) {
        if (error.error?.type === 'tokens') {
          console.log(`Rate limit reached. Pausing at index ${i}`);
          return result;
        }
        throw error;
      }
    }
    result.tokenCost.cost = this.calculateCost(
      result.tokenCost.tokens,
      model.modelName,
    );
    return result;
  }
  /**
   * Counts tokens in the given text for the specified model.
   * @returns Number of tokens.
   */
  private countTokens(text: string, model: string = 'gpt-3.5-turbo'): number {
    const encoder = encoding_for_model(model as TiktokenModel);
    const tokens = encoder.encode(text);
    encoder.free();
    return tokens.length;
  }
  /**
   * Calculates the cost of token usage.
   * @returns Total cost.
   */
  private calculateCost(tokens: TokenCount, model: string): number {
    const pricing =
      PRICING[model as keyof typeof PRICING] || PRICING['gpt-3.5-turbo'];
    return (
      (tokens.input * pricing.input + tokens.output * pricing.output) / 1000
    );
  }
}
