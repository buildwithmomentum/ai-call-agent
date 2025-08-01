import { WebSocketAdapter } from '@nestjs/common';
import { INestApplicationContext } from '@nestjs/common';
import * as WebSocket from 'ws';
import { Server } from 'http';
import { Observable, fromEvent } from 'rxjs';
import { map } from 'rxjs/operators';
import { MessageMappingProperties } from '@nestjs/websockets';

export class TwilioWebSocketAdapter implements WebSocketAdapter {
  private wsServer: WebSocket.Server;

  constructor(private app: INestApplicationContext, private server: Server) {}

  create(port: number, options: any = {}): WebSocket.Server {
    return new WebSocket.Server({
      server: this.server,
      path: options.path || '/twilio/media-stream',
    });
  }

  bindClientConnect(server: WebSocket.Server, callback: (client: WebSocket, ...args: any[]) => void) {
    server.on('connection', (client, ...args) => {
      callback(client, ...args);
    });
  }

  bindClientDisconnect(client: WebSocket, callback: () => void) {
    client.on('close', callback);
  }

  bindMessageHandlers(
    client: WebSocket,
    handlers: MessageMappingProperties[],
    transform: (data: any) => Observable<any>,
  ) {
    fromEvent(client, 'message')
      .pipe(
        map((message: WebSocket.MessageEvent) => {
          try {
            return JSON.parse(message.data.toString());
          } catch (error) {
            console.error('Error parsing message:', error, 'Raw message:', message.data.toString());
            return { event: 'error', data: message.data };
          }
        }),
      )
      .subscribe((message) => {
        const messageEvent = message.event;
        const messageData = message.data;

        // Find the handler for this message event
        const handler = handlers.find(
          handler => handler.message === messageEvent,
        );

        if (handler) {
          handler.callback(messageData);
        } else {
          // Handle all messages with a default handler
          handlers.forEach(handler => {
            if (handler.message === 'message') {
              handler.callback(message);
            }
          });
        }
      });
  }

  close(server: WebSocket.Server) {
    server.close();
  }
} 