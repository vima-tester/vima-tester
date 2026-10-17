import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AgentWsAdapter } from './agents/agent-ws.adapter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173',
  });
  app.useWebSocketAdapter(new AgentWsAdapter(app));

  const port = config.get<number>('PORT') ?? 3001;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`relay listening on http://localhost:${port}`);
  logger.log(`agent websocket at ws://localhost:${port}/agent`);
}

void bootstrap();
