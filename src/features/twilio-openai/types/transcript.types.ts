export interface TranscriptMessage {
  role: 'user' | 'ai';
  transcript: string;
  time: string;
}

export interface CallTranscript {
  streamSid: string;
  callerNumber: string;    // The number making the call (From)
  receiverNumber: string;  // The number receiving the call (To)
  messages: TranscriptMessage[];
  startTime: string;
  endTime?: string;
}
