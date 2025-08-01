import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { Logger } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { winstonLoggerConfig } from './utils/winston-logger.config';

dotenv.config();

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: WinstonModule.createLogger(winstonLoggerConfig),
  });
  app.useStaticAssets(join(__dirname, '..', 'public'));
  
  // Enable CORS with updated configuration for ngrok
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://localhost:3000',
      'http://localhost:3001',
      'https://localhost:3001',
      'http://localhost:8000',
      'http://localhost:8001',
      'https://build-operatorai-backend-production.up.railway.app',
      'https://build-operatorai-frontend-production.up.railway.app',
      'https://apparent-grossly-crane.ngrok-free.app',
      'https://operator-ai-alpha.vercel.app',
      'https://operator-ai-v1.vercel.app',
      // Add wildcard to allow all ngrok connections
      /https:\/\/.*\.ngrok-free\.app$/
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
  });

  // Updated Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Voice_Agent App API')
    .setDescription('API documentation for Voice_Agent modules')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'Authorization'
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3000;
  
  // Important: Listen on all interfaces (0.0.0.0) to ensure ngrok can reach the server
  await app.listen(port, '0.0.0.0');
  
  const appUrl = await app.getUrl();
  logger.log(`Application is running on: ${appUrl}`);
  logger.log(`Twilio media stream endpoints available at: /twilio/media-stream and /twilio-openai/media-stream`);
}
bootstrap();
