import { Injectable, Logger } from '@nestjs/common';

export interface CallSession {
  callSid: string;
  agentId: string;
  streamSid?: string;
  fromNumber: string;
  toNumber: string;
  startTime: Date;
  endTime?: Date;
}

@Injectable()
export class CallSessionService {
  private readonly logger = new Logger(CallSessionService.name);
  private activeSessions = new Map<string, CallSession>();
  private streamToCallSid = new Map<string, string>();
  
  createSession(callSid: string, agentId: string, fromNumber: string, toNumber: string): CallSession {
    const session: CallSession = {
      callSid,
      agentId,
      fromNumber,
      toNumber,
      startTime: new Date(),
    };
    this.activeSessions.set(callSid, session);
    this.logger.log(`Call session created: ${callSid} [Agent: ${agentId}]`);
    return session;
  }

  associateStreamWithCall(streamSid: string, callSid: string) {
    // Check if this association already exists to prevent duplicate logs
    if (this.streamToCallSid.get(streamSid) === callSid) {
      return; // Skip if already associated
    }
    
    this.streamToCallSid.set(streamSid, callSid);
    const session = this.activeSessions.get(callSid);
    if (session) {
      session.streamSid = streamSid;
      this.logger.debug(`Stream ${streamSid} associated with call ${callSid}`);
    } else {
      this.logger.error(`Failed to associate stream: No session for call ${callSid}`);
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
      this.logger.log(`Call session ended: ${callSid}`);
      
      if (session.streamSid) {
        this.streamToCallSid.delete(session.streamSid);
      }
      this.activeSessions.delete(callSid);
    } else {
      this.logger.warn(`Attempted to end non-existent session: ${callSid}`);
    }
  }
}
