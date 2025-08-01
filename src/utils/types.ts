import { HttpStatus } from '@nestjs/common';

export type CustomResponse = {
  error?: boolean;
  msg?: string;
  status?: HttpStatus;
  data?: any;
};

export interface Model {
  last_trained: string;
  model: string;
  temperature: number;
  assistantLanguage: string;
  
  instruction: string;
  persona: string;
  constraints: string;
}
export interface VoiceAgentSettings {
  model: {
    last_trained: string;
    model: string;
    temperature: number;
    assistantLanguage: string;
    instruction: string;
    persona: string;
    constraints: string;
  };
  security: {
    visibility: string;
    permitIframeWidgetSpecificDomains: boolean;
    rateLimiting: { messages: number; seconds: number };
    limitPrompt: string;
    contactEmailForLimit: string;
  };
  notifications: {
    dailyLeadsEmail: boolean;
    dailyLeadsEmailList: Array<string>;
    dailyConversationEmail: boolean;
    dailyConversationEmailList: Array<string>;
  };

  interface: {
    initial_messages: string;
    recommended_messages: string;
    message_placeholder: string;
    theme: string;
    accentColor: string;
    textColor: string;
    update_voiceagent_profile_picture: string;
    remove_voiceagent_profile_picture: boolean;
    display_name: string;
    user_message_color: string;
    social_integration_appearance: object;
    button_background_color: string;
    button_text_color: string;
    chat_bubble_button_color: string;
    align_chat_bubble_button: boolean;
    launcherIcon: string;
    launcherText: string;
    headerIcon: string;
    shareIcon: string;
    fontSize: string;
    enableSources: string;
    autoScrollToNewMessages: string;
    horizontalSmartPrompts: string;
    position: string;
    hidePoweredBy: string;
  };

  domain: {
    custom_domain_for_script_iframe_andvoiceagent: string;
    verified_domain: string;
    verified_domain_status: string;
    TXT_Verification: string;
    dns_verification: boolean;
  };

  leadForm: {
    showLeadForm: boolean;
    title: string;
    email: boolean;
    name: boolean;
    phone: boolean;
  };
}

export const PRICING = {
  'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4o': { input: 0.03, output: 0.06 },
};

export interface TokenCount {
  input: number;
  output: number;
}

export interface TokenCost {
  tokens: TokenCount;
  cost: number;
}

export const headersForWorkAround = {
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  Priority: 'u=0, i',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

export interface WebsiteData {
  link: string;
  size: number;
  title: string;
  content: string;
}

export interface AddWebsiteResult {
  FileDataID: string | null;
  site: WebsiteData;
}
