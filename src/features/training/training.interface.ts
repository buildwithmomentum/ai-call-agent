export interface SourceProcessor {
  process: (params: {
    voiceAgentId: string;
    userId: string;
    type: string;
    content: any;
    transcriptionService: 'openai' | 'elevenlabs';  // Make this required instead of optional
  }) => Promise<any>;
}

export type TrainingRequestBody = {
  data: string | string[];
  name?: string;
  scrapingId?: string;
};
export type TrainingRequestContent = Express.Multer.File | { data: string[] | string; name?: string; scrappingId?: string };

export interface WebsiteData {
  link: string;
  size: number;
  title: string;
  content: string;
}

export interface AddWebsiteResult {
  FileDataID: string;
  site: WebsiteData;  // Changed from string to WebsiteData
}

export interface TokenCount {
  input: number;
  output: number;
}
export interface TokenCost {
  tokens: TokenCount;
  cost: number;
}
