import { WebSocketAdapter, INestApplicationContext, Logger } from '@nestjs/common';
import { MessageMappingProperties } from '@nestjs/websockets';
import * as WebSocket from 'ws';
import { Observable, fromEvent, EMPTY } from 'rxjs';
import { mergeMap, filter } from 'rxjs/operators';
import * as url from 'url';

export class WsAdapter implements WebSocketAdapter {
  private readonly logger = new Logger('WsAdapter');
  
  constructor(private app: INestApplicationContext) {}

  create(port: number, options: any = {}): any {
    this.logger.log(`Creating WebSocket server with options: ${JSON.stringify(options)}`);
    
    // For ngrok, we need to ensure the server is properly configured
    const serverOptions = {
      ...options,
      // Important: Don't specify a path here, handle it in the connection
      noServer: false, // Allow the server to handle the upgrade itself
      handleProtocols: (protocols, req) => {
        this.logger.log(`Handling protocols: ${protocols}`);
        return protocols ? protocols[0] : '';
      },
      verifyClient: (info, callback) => {
        this.logger.log(`Verifying client connection from: ${info.origin || 'unknown origin'}`);
        this.logger.log(`Connection URL: ${info.req.url}`);
        // Accept all connections - we'll filter in the handleConnection method
        callback(true);
      }
    };
    
    const server = new WebSocket.Server(serverOptions);
    
    server.on('error', (err) => {
      this.logger.error(`WebSocket server error: ${err.message}`, err.stack);
    });
    
    server.on('listening', () => {
      this.logger.log('WebSocket server is listening');
    });
    
    // Log all connection attempts
    server.on('connection', (socket, request) => {
      this.logger.log(`Raw WebSocket connection received: ${request.url}`);
    });
    
    return server;
  }

  bindClientConnect(server, callback: Function) {
    this.logger.log('Setting up connection handler for WebSocket server');
    
    server.on('connection', (client, req) => {
      // Parse the URL to get the path
      const parsedUrl = url.parse(req.url);
      this.logger.log(`Client connected with path: ${parsedUrl.pathname}`);
      // this.logger.log(`Headers: ${JSON.stringify(req.headers)}`);
      
      // Pass the connection to the gateway
      callback(client, req);
    });
    
    server.on('error', (err) => {
      this.logger.error(`Error in WebSocket connection: ${err.message}`, err.stack);
    });
  }

  bindMessageHandlers(
    client: WebSocket,
    handlers: MessageMappingProperties[],
    process: (data: any) => Observable<any>,
  ) {
    this.logger.log('Binding message handlers for WebSocket client');
    
    fromEvent(client, 'message')
      .pipe(
        mergeMap(data => {
          try {
            return this.bindMessageHandler(data, handlers, process);
          } catch (error) {
            this.logger.error(`Error handling WebSocket message: ${error.message}`, error.stack);
            return EMPTY;
          }
        }),
        filter(result => result),
      )
      .subscribe(
        response => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(response));
          }
        },
        error => {
          this.logger.error(`Error in WebSocket subscription: ${error.message}`, error.stack);
        }
      );
      
    client.on('error', (err) => {
      this.logger.error(`WebSocket client error: ${err.message}`, err.stack);
    });
    
    client.on('close', (code, reason) => {
      this.logger.log(`WebSocket client disconnected. Code: ${code}, Reason: ${reason || 'No reason provided'}`);
    });
  }

  bindMessageHandler(
    buffer,
    handlers: MessageMappingProperties[],
    process: (data: any) => Observable<any>,
  ): Observable<any> {
    let message = buffer.data;
    try {
      message = JSON.parse(buffer.data);
      this.logger.debug(`Received WebSocket message: ${JSON.stringify(message)}`);
    } catch (error) {
      // Raw binary data, keep as is
      this.logger.debug('Received binary WebSocket message');
    }

    const messageHandler = handlers.find(
      handler => handler.message === message.event,
    );
    
    if (!messageHandler) {
      // For Twilio media streams, we often don't have explicit message handlers
      // as the processing is done in the service
      return EMPTY;
    }
    
    return process(messageHandler.callback(message));
  }

  close(server) {
    this.logger.log('Closing WebSocket server');
    server.close();
  }
} 