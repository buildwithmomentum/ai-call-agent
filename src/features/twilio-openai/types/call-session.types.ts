export interface Transcript {
  timestamp: Date;
  type: 'assistant' | 'user';
  content: string;
  eventId: string;
  itemId: string;
}

export interface CallSession {
  streamSid?: string;
  callSid: string;
  agentId: string;
  fromNumber: string;
  toNumber: string;
  startTime: Date;
  endTime?: Date;
  transcripts?: Transcript[];
}
