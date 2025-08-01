export interface GrokChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GrokChatRequest {
  messages: GrokChatMessage[];
  model?: string;
  temperature?: number;
}

export interface GrokChatResponse {
  content: string;
  model: string;
  success: boolean;
  error?: string;
}

export interface GrokConfig {
  model: string;
  baseURL: string;
  temperature: number;
  systemMessage: string;
}

export interface TwilioGrokState extends Record<string, any> {
  systemMessage?: string;
  modelName?: string;
  temperature?: number;
  voice?: string;
}

export interface GrokVoiceConfig extends GrokConfig {
  voice?: string;
  speakingStyle?: string;
  speedRate?: number;
}