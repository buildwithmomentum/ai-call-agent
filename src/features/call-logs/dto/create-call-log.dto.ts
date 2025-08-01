export class CreateCallLogDto {
  voice_agent_id: string;
  call_start: string;
  call_end?: string;
  caller_number?: string;
  transcript?: Array<{ role: string; transcript: string; time: string }>;
  status: string;
  duration?: string; // human-readable format e.g., "MM:SS.MS"
  summary?: {
    topics: string[];
    userRequests: string[];
    actionsTaken: string[];
    satisfaction: {
      level: 'positive' | 'negative' | 'neutral';
      indicators: string[];
    };
    businessInquiries: string[];
    goalsAchieved: boolean;
    followUpNeeded: boolean;
    followUpActions: string[];
    userIntent: {
      primary: string;
      secondary: string[];
      context: string;
    };
    urgencyAssessment: {
      level: 'emergency' | 'urgent' | 'normal' | 'low';
      reason: string;
      requiresImmediateAction: boolean;
    };
  };
  summary_metadata?: {
    userMessageCount: number;
    aiMessageCount: number;
    totalMessages: number;
    summarizedAt: string;
    conversationMetrics: {
      topicsDiscussed: number;
      actionsTakenCount: number;
      satisfactionLevel: string;
      urgencyLevel: string;
      primaryIntent: string;
    };
    escalation: {
      wasEscalated: boolean;
      reason: string;
      timestamp?: string;
      urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
      customerState: string;
    };
  };
}
