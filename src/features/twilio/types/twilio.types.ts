import * as WebSocket from 'ws';
import OpenAI from 'openai';

// Export the Message type using the correct OpenAI type
export type Message = OpenAI.Chat.ChatCompletionMessageParam;

export interface LLMProvider {
  generateChatCompletion: (
    userInput: string,
    systemMessage: string,
    modelName?: string,
    temperature?: number,
    conversationHistory?: Message[]
  ) => Promise<{
    success: boolean;
    content?: string;
    error?: string;
  }>;

  streamResponseToHistory?(
    message: string,
    onChunk: (chunk: string) => void,
    systemMessage?: string,
    modelName?: string,
    temperature?: number,
    conversationHistory?: Message[]
  ): Promise<{
    success: boolean;
    content?: string;
    error?: string;
  }>;
}

export interface ClientConnection {
  openAiWs: WebSocket;
  elevenLabsWs: WebSocket;
  state: any;
  callSid: string;
  heartbeatInterval?: NodeJS.Timeout;
  createdAt?: number; // Timestamp when connection was created
  lastActivity?: number; // Timestamp of last activity
} 