import { Controller, Get, Post, Req, Res, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { TwilioOpenaiService } from './twilio-openai.service';
import { Request, Response } from 'express';
import * as WebSocket from 'ws';
import { HttpAdapterHost } from '@nestjs/core';

@Controller('twilio-openai')
export class TwilioOpenaiController implements OnModuleInit {
  private readonly logger = new Logger(TwilioOpenaiController.name);
  
  constructor(
    private readonly twilioOpenaiService: TwilioOpenaiService,
    private readonly httpAdapterHost: HttpAdapterHost,
    @Inject('TWILIO_WEBSOCKET_SERVER') private readonly wss: WebSocket.Server
  ) {}

  onModuleInit() {
    this.logger.log('TwilioOpenaiController initialized');
    
    // Get the HTTP server from the HTTP adapter
    const httpServer = this.httpAdapterHost.httpAdapter.getHttpServer();
    
    // Handle upgrade requests for WebSocket connections
    httpServer.on('upgrade', (request, socket, head) => {
      const url = request.url;
      
      this.logger.log(`WebSocket upgrade request received for URL: ${url}`);
      // this.logger.log(`Headers: ${JSON.stringify(request.headers)}`);
      
      if (url.includes('/twilio-openai/media-stream')) {
        this.logger.log('Matching twilio-openai/media-stream path, handling upgrade');
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.logger.log('WebSocket connection upgraded successfully for twilio-openai');
          this.wss.emit('connection', ws, request);
        });
      }
    });
    
    // Handle WebSocket connections
    this.wss.on('connection', (ws, request) => {
      this.logger.log('WebSocket client connected to twilio-openai');
      this.twilioOpenaiService.handleWebSocketConnection(ws, request);
    });
  }

  @Get()
  getWelcomeMessage() {
    return this.twilioOpenaiService.getWelcomeMessage();
  }

  @Post('incoming-call')
  async handleIncomingCall(@Req() req: Request, @Res() res: Response) {
    const toNumber = req.body.To;
    const fromNumber = req.body.From;
    const callSid = req.body.CallSid;
    
    this.logger.log(`Incoming call received - To: ${toNumber}, From: ${fromNumber}, CallSid: ${callSid}`);
    this.logger.log(`Full request body: ${JSON.stringify(req.body)}`);
    
    try {
      // Set the voice agent ID based on the called number
      const agentId = await this.twilioOpenaiService.initializeCallSession(callSid, toNumber, fromNumber);
      
      const host = req.headers.host;
      const twiml = this.twilioOpenaiService.getTwimlResponse(host);
      
      res.setHeader('Content-Type', 'text/xml');
      res.send(twiml);
    } catch (error) {
      this.logger.error(`Error handling incoming call: ${error.message}`);
      
      // Provide a more specific fallback TwiML response about the voice assistant not being available
      const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say>We're sorry, but the voice assistant service is not available for this phone number ${toNumber}.</Say>
          <Pause length="1"/>
          <Say>Please try calling a different number or contact support for assistance.</Say>
          <Pause length="1"/>
          <Say>Thank you for your understanding. Goodbye.</Say>
          <Hangup/>
        </Response>`;
      
      res.setHeader('Content-Type', 'text/xml');
      res.send(fallbackTwiml);
    }
  }
}