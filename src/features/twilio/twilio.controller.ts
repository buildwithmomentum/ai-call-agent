import { Controller, Post, Get, Body, Req, Res, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { TwilioService } from './twilio.service';

@Controller('twilio')
export class TwilioController {
  private readonly logger = new Logger(TwilioController.name);

  constructor(private readonly twilioService: TwilioService) {}

  @Post('incoming-call')
  async handleIncomingCall(@Req() req: Request, @Res() res: Response) {
    try {
      // Extract Twilio parameters
      const from = req.body.From;
      const to = req.body.To;
      const callSid = req.body.CallSid;
      
      this.logger.log(`Incoming call: ${callSid} [From: ${from}, To: ${to}]`);
      
      // Initialize a session for this call
      await this.twilioService.initializeCallSession(callSid, to, from);
      
      // Get the base URL for the WebSocket
      const host = req.headers.host;
      
      // Generate and return TwiML response
      const twiml = this.twilioService.getTwimlResponse(host);
      
      res.setHeader('Content-Type', 'text/xml');
      res.send(twiml);
    } catch (error) {
      this.logger.error(`Call handling error: ${error.message}`);
      
      // Return a basic error TwiML
      res.setHeader('Content-Type', 'text/xml');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
      <Response>
          <Say>Sorry, our system is experiencing technical difficulties. Please try again later.</Say>
          <Hangup/>
      </Response>`);
    }
  }

  
}
