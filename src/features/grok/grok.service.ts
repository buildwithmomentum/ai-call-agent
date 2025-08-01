import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { GrokChatResponse, GrokConfig } from './types/grok.types';
import { Response } from 'express';
import axios from 'axios';
import { FunctionExecutorService } from './function-executor.service';
import { FunctionResult } from './types/Functionexecution.type';

// Load environment variables directly from .env file
dotenv.config();

// Update Message interface to use OpenAI's types
type Message = OpenAI.Chat.ChatCompletionMessage;

@Injectable()
export class GrokService {
  private readonly logger = new Logger(GrokService.name);
  private readonly client: OpenAI;
  private readonly GROK_BASE_URL = 'https://api.x.ai/v1';
  private functionsData: any[] = []; // Store functions data
  private voiceAgentId: string | null = null; // Store voiceAgentId

  constructor(
    private configService: ConfigService,
    private functionExecutorService: FunctionExecutorService
  ) {
    const apiKey = process.env.GROK_API_KEY;
    
    if (!apiKey) {
      this.logger.error('Grok API key is not defined in environment variables');
      throw new Error('Missing Grok API key. Please set GROK_API_KEY in the .env file.');
    }
    
    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: this.GROK_BASE_URL,
    });
  }

  // Method to set functions data
  setFunctionsData(functions: any[]) {
    this.logger.log('Setting functions data in GrokService');
    this.functionsData = functions || [];
    // Also set the functions data in the FunctionExecutorService
    this.functionExecutorService.setFunctionsData(functions || []);
  }

  // Method to get functions data
  getFunctionsData(): any[] {
    return this.functionsData;
  }

  // Method to set voiceAgentId
  setVoiceAgentId(id: string) {
    this.logger.log(`Setting voiceAgentId: ${id}`);
    this.voiceAgentId = id;
    // Also set the voiceAgentId in the FunctionExecutorService
    this.functionExecutorService.setVoiceAgentId(id);
  }

  // Method to get voiceAgentId
  getVoiceAgentId(): string | null {
    return this.voiceAgentId;
  }

  async generateChatCompletion(
    message: string,
    systemMessage: string,
    modelName: string,
    temperature: number,
    conversationHistory: Message[] = []
  ): Promise<GrokChatResponse> {
    try {
      // Create properly typed messages array
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemMessage },
        ...conversationHistory,
        { role: 'user', content: message }
      ];

      const response = await this.client.chat.completions.create({
        model: modelName,
        messages,
        temperature
      });

      return {
        content: response.choices[0].message.content || '',
        model: response.model,
        success: true,
      };
    } catch (error) {
      this.logger.error(`Error generating Grok chat completion: ${error.message}`);
      return {
        content: "I'm sorry, I encountered an error processing your request.",
        model: modelName,
        success: false,
        error: error.message,
      };
    }
  }

  // Method for handling streaming responses in the TwilioGrok integration
  async generateStreamingCompletion(
    message: string,
    onChunk: (chunk: string) => void,
    systemMessage: string,
    modelName: string,
    temperature: number,
    conversationHistory: Message[] = []
  ): Promise<GrokChatResponse> {
    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemMessage },
        ...conversationHistory,
        { role: 'user', content: message }
      ];

      const stream = await this.client.chat.completions.create({
        model: modelName,
        messages,
        temperature,
        stream: true,
      });

      let fullContent = '';
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          onChunk(content);
        }
      }

      return {
        content: fullContent,
        model: modelName,
        success: true,
      };
    } catch (error) {
      this.logger.error(`Error streaming Grok chat completion: ${error.message}`);
      return {
        content: "I'm sorry, I encountered an error processing your request.",
        model: modelName,
        success: false,
        error: error.message,
      };
    }
  }

  // New streaming method
  async streamChatCompletion(
    response: Response,
    message: string,
    systemMessage: string,
    modelName: string,
    temperature: number,
  ): Promise<void> {
    try {
      // Set appropriate headers for SSE (Server-Sent Events)
      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');
      
      const stream = await this.client.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: message },
        ],
        temperature,
        stream: true,
      });

      // Send initial event
      response.write('event: start\ndata: {}\n\n');
      
      let fullContent = '';
      
      // Process each chunk as it arrives
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          // Send the chunk to the client
          response.write(`event: chunk\ndata: ${JSON.stringify({ content })}\n\n`);
        }
      }
      
      // Send completion event with full text
      response.write(`event: complete\ndata: ${JSON.stringify({ 
        content: fullContent,
        model: modelName,
        success: true
      })}\n\n`);
      
      // End the response
      response.end();
    } catch (error) {
      this.logger.error(`Error streaming Grok chat completion: ${error.message}`);
      
      // Send error event
      response.write(`event: error\ndata: ${JSON.stringify({ 
        content: "I'm sorry, I encountered an error processing your request.",
        model: modelName,
        success: false,
        error: error.message
      })}\n\n`);
      
      response.end();
    }
  }

  // Format tools for Grok API
  private formatToolsForGrok(tools: any[] = []): any[] {
    // this.logger.log('Raw tools received:', JSON.stringify(tools, null, 2));

    if (!tools?.length) {
      this.logger.log('No tools provided, returning empty array');
      return [];
    }

    const formattedTools = tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));

    // this.logger.log('Formatted tools for Grok:', JSON.stringify(formattedTools, null, 2));
    return formattedTools;
  }

  // Handle tool calls using the FunctionExecutorService
  async executeToolCall(toolCall: any): Promise<any> {
    // Extract function details
    if (!toolCall || !toolCall.function || !toolCall.function.name) {
      this.logger.error('Invalid tool call format');
      return { error: 'Invalid tool call format' };
    }

    const functionName = toolCall.function.name;
    let args: any = {};
    
    try {
      args = JSON.parse(toolCall.function.arguments || '{}');
    } catch (error) {
      this.logger.error(`Error parsing arguments: ${error.message}`);
      return { error: `Invalid function arguments: ${error.message}` };
    }

    // Create a function call object for internal processing
    const functionCall = {
      name: functionName,
      arguments: args
    };

    // Execute using the new internal function executor
    const result: FunctionResult = await this.functionExecutorService.executeInternalFunction(
      functionCall,
      this.voiceAgentId,
      this.functionsData
    );

    return result.status === 'success' ? result.data : { error: result.error };
  }

  // Method for handling streaming responses while updating conversation history
  async streamResponseToHistory(
    message: string,
    onChunk: (chunk: string) => void,
    systemMessage: string,
    modelName: string,
    temperature: number,
    conversationHistory: Message[] = [],
    rawTools: any[] = []
  ): Promise<GrokChatResponse> {
    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemMessage },
        ...conversationHistory,
        { role: 'user', content: message }
      ];

      const formattedTools = this.formatToolsForGrok(rawTools);
      const hasTools = formattedTools.length > 0;

      const stream = await this.client.chat.completions.create({
        model: modelName,
        messages,
        temperature,
        stream: true,
        tools: hasTools ? formattedTools : undefined,
        tool_choice: hasTools ? 'auto' : undefined
      });

      let fullContent = '';
      let toolCallsComplete: any[] = [];
      let currentToolCall: any = null;
      
      for await (const chunk of stream) {
        // Handle tool calls in the response
        if (chunk.choices[0]?.delta?.tool_calls) {
          const toolCallsChunk = chunk.choices[0].delta.tool_calls;
          
          for (const toolCallChunk of toolCallsChunk) {
            const index = toolCallChunk.index;
            
            // Initialize tool call if it doesn't exist
            if (!currentToolCall || currentToolCall.index !== index) {
              currentToolCall = { index, function: { name: '', arguments: '' } };
            }
            
            // Append function name and arguments
            if (toolCallChunk.function?.name) {
              currentToolCall.function.name = toolCallChunk.function.name;
            }
            
            if (toolCallChunk.function?.arguments) {
              currentToolCall.function.arguments = 
                (currentToolCall.function.arguments || '') + toolCallChunk.function.arguments;
            }
            
            // Check if the tool call is complete
            if (chunk.choices[0]?.finish_reason === 'tool_calls') {
              toolCallsComplete.push(currentToolCall);
              currentToolCall = null;
            }
          }
        }

        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          onChunk(content);
        }
      }

      // Process completed tool calls
      if (toolCallsComplete.length > 0) {
        this.logger.log(`Processing ${toolCallsComplete.length} completed tool calls`);
        
        for (const toolCall of toolCallsComplete) {
          const result = await this.executeToolCall(toolCall);
          
          if (result) {
            // Add the tool call result to the conversation
            conversationHistory.push({
              role: 'assistant',
              tool_calls: [
                {
                  id: `call_${Date.now()}`,
                  type: 'function',
                  function: {
                    name: toolCall.function.name,
                    arguments: toolCall.function.arguments
                  }
                }
              ]
            } as unknown as Message);
            
            // Format the result content based on the result structure
            let resultContent = '';
            if (Array.isArray(result) && result[0]?.context) {
              // Handle the structure from our new function executor's success result
              resultContent = result[0].context;
            } else {
              // Fall back to standard JSON stringification
              resultContent = JSON.stringify(result);
            }
            
            // Add tool result to conversation
            conversationHistory.push({
              role: 'tool',
              tool_call_id: `call_${Date.now()}`,
              content: resultContent
            } as unknown as Message);
            
            // Generate a new response based on the tool result
            const followUpResponse = await this.client.chat.completions.create({
              model: modelName,
              messages: [
                { role: 'system', content: systemMessage },
                ...conversationHistory
              ],
              temperature
            });
            
            const followUpContent = followUpResponse.choices[0].message.content || '';
            fullContent += '\n' + followUpContent;
            onChunk(followUpContent);
          }
        }
      }

      // Add assistant's response to conversation history
      if (fullContent) {
        conversationHistory.push({
          role: 'assistant',
          content: fullContent
        } as Message);
      }

      return {
        content: fullContent,
        model: modelName,
        success: true,
      };
    } catch (error) {
      this.logger.error(`Error streaming Grok chat completion: ${error.message}`);
      return {
        content: "I'm sorry, I encountered an error processing your request.",
        model: modelName,
        success: false,
        error: error.message,
      };
    }
  }
}