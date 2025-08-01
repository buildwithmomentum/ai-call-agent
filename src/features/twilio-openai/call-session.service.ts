import { Injectable, Logger } from '@nestjs/common';


export interface CallSession {
  callSid: string;
  agentId: string;
  streamSid?: string;
  fromNumber: string;
  toNumber: string;
  startTime: Date;
  endTime?: Date;
  transcripts?: Transcript[];
}

export interface Transcript {
  timestamp: Date;
  type: 'user' | 'assistant';
  content: string;
  eventId?: string;
  itemId?: string;
}

@Injectable()
export class CallSessionService {
  private readonly logger = new Logger(CallSessionService.name);
  private activeSessions = new Map<string, CallSession>();
  private streamToCallSid = new Map<string, string>();

  private logTranscript(transcript: Transcript) {
    const timestamp = transcript.timestamp.toLocaleTimeString();
    const speaker = transcript.type === 'assistant' ? '🤖' : '👤';
    process.stdout.write(`${speaker} "${transcript.content}"\n`);
  }

  createSession(callSid: string, agentId: string, fromNumber: string, toNumber: string): CallSession {
    const session: CallSession = {
      callSid,
      agentId,
      fromNumber,
      toNumber,
      startTime: new Date(),
    };
    this.activeSessions.set(callSid, session);
    return session;
  }

  associateStreamWithCall(streamSid: string, callSid: string) {
    this.streamToCallSid.set(streamSid, callSid);
    const session = this.activeSessions.get(callSid);
    if (session) {
      session.streamSid = streamSid;
    }
  }

  getSessionByCallSid(callSid: string): CallSession | undefined {
    return this.activeSessions.get(callSid);
  }

  getSessionByStreamSid(streamSid: string): CallSession | undefined {
    const callSid = this.streamToCallSid.get(streamSid);
    return callSid ? this.activeSessions.get(callSid) : undefined;
  }

  endSession(callSid: string) {
    const session = this.activeSessions.get(callSid);
    if (session) {
      session.endTime = new Date();
      if (session.streamSid) {
        this.streamToCallSid.delete(session.streamSid);
      }
      this.activeSessions.delete(callSid);
    }
  }

  addTranscript(callSid: string, transcript: Transcript) {
    const session = this.activeSessions.get(callSid);
    if (session) {
      if (!session.transcripts) {
        session.transcripts = [];
      }
      session.transcripts.push(transcript);
      this.logTranscript(transcript);
    }
  }

  getTranscripts(callSid: string): Transcript[] {
    const session = this.activeSessions.get(callSid);
    return session?.transcripts || [];
  }

  handleAudioTranscript(streamSid: string, transcriptData: any) {
    const callSid = this.streamToCallSid.get(streamSid);
    if (!callSid) {
      this.logger.error(`No call session found for StreamSid: ${streamSid}`);
      return;
    }

    const transcript: Transcript = {
      timestamp: new Date(),
      type: 'assistant',
      content: transcriptData.transcript,
      eventId: transcriptData.event_id,
      itemId: transcriptData.item_id
    };

    this.addTranscript(callSid, transcript);
  }

  handleUserTranscript(streamSid: string, transcriptData: any) {
    const callSid = this.streamToCallSid.get(streamSid);
    if (!callSid) {
      this.logger.error(`No call session found for StreamSid: ${streamSid}`);
      return;
    }

    const transcript: Transcript = {
      timestamp: new Date(),
      type: 'user',
      content: transcriptData.transcript,
      eventId: transcriptData.event_id,
      itemId: transcriptData.item_id
    };

    this.addTranscript(callSid, transcript);
  }

  formatTranscript(transcripts: Transcript[]): Array<{ role: string; transcript: string; time: string }> {
    return transcripts.map(t => ({
      role: t.type === 'assistant' ? 'ai' : 'user',
      transcript: t.content,
      time: t.timestamp.toISOString()
    }));
  }

  calculateDuration(startTime: Date, endTime: Date): string {
    const durationMs = endTime.getTime() - startTime.getTime();
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  prepareFinalCallData(callSid: string): any {
    const session = this.getSessionByCallSid(callSid);
    if (!session || !session.endTime) return null;

    return {
      voice_agent_id: session.agentId,
      call_start: session.startTime.toISOString(),
      call_end: session.endTime.toISOString(),
      caller_number: session.fromNumber,
      transcript: this.formatTranscript(session.transcripts || []),
      duration: this.calculateDuration(session.startTime, session.endTime),
      status: 'completed',
      
    };
  }
}
