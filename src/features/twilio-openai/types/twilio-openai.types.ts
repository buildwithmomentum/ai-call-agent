export interface TwilioOpenAIConfig {
  model: string;
  voice: string;
  temperature: number;
  SYSTEM_MESSAGE: string;
  tools?: any[];
}

export interface ModelConfig extends TwilioOpenAIConfig {}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  model: 'gpt-4',
  voice: 'alloy',
  temperature: 0.7,
  SYSTEM_MESSAGE: 'You are a helpful voice assistant.',
};
