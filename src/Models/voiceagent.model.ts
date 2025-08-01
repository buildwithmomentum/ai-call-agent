export interface Voiceagent {
  id?: string;
  name: string;
  created_by?: string;
  created_at?: string;
  last_trained_at: string;
  takeOverTimeout: string;
  summary: Summary;
  private_settings: private_settings;
  unAvailable?: boolean;
}

export interface private_settings {
  model: Model;
  
}

export interface Model {
  model: string;
  temperature: number;
  assistantLanguage?: string;
  aiInputLanguage?: string;
  SYSTEM_MESSAGE: string;
  noAnswerMessage?: string;
  unAvailabilityMessage?: string;
  last_trained?: string;
  voice?: string;
}

export interface Summary {}

export interface security {
  visibility: string;
  permitIframeWidgetSpecificDomains: boolean;
  rateLimiting: {
    messages: number;
    seconds: number;
  };
  limitPrompt: string;
  contactEmailForLimit: string;
}

export interface notifications {
  dailyLeadsEmail: boolean;
  dailyLeadsEmailList: Array<string>;
  dailyConversationEmail: boolean;
  dailyConversationEmailList: Array<string>;
}

export interface VoiceAgentSettings {
  initial_messages: string;
  message_placeholder: string;
  theme: string;
  accentColor: string;
  backgroundColor: string;
  buttonColor: string;
  launcherIcon: string;
  launcherText: string;
  respondText: string[];
  greetingText: string;
  headerIcon: string;
  shareIcon: string;
  enableSources: boolean;
  autoScrollToNewMessages: boolean;
  position: string;
  hidePoweredBy: boolean;
  showProducts: boolean;
  showSmartPrompts: boolean;
}

export interface domain {
  custom_domain_for_script_iframe_andvoiceagent: string;
  verified_domain: string;
  verified_domain_status: string;
  TXT_Verification: string;
  dns_verification: boolean;
}

export interface LeadForm {
  showLeadForm: boolean;
  title: string;
  email: boolean;
  name: boolean;
  phone: boolean;
}
