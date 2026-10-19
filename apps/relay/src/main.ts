import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AgentWsAdapter } from './agents/agent-ws.adapter';

async function bootstrap(): Promise<void> {
  // Replace Nest's default body parser so the relay accepts larger JSON bodies
  // than Express' 100 kB default, which 413s legitimate API-test payloads.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const config = app.get(ConfigService);

  // The web app calls the relay cross-origin, so helmet's default
  // `same-origin` resource policy would block those responses.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.useBodyParser('json', { limit: config.get<number>('MAX_REQUEST_BODY_BYTES') });

  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173',
  });

  // Behind a trusted proxy, trust the first hop so rate limiting keys on the
  // real client IP. Left off by default (a directly-exposed relay would
  // otherwise let clients spoof their address).
  if (config.get<boolean>('TRUST_PROXY')) {
    app.set('trust proxy', 1);
  }

  app.useWebSocketAdapter(new AgentWsAdapter(app));

  // Drain in-flight jobs and close agent sockets on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  const port = config.get<number>('PORT') ?? 3001;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`relay listening on http://localhost:${port}`);
  logger.log(`agent websocket at ws://localhost:${port}/agent`);
}

void bootstrap();
