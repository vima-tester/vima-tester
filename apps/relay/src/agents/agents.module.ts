import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AgentConnectionsModule } from './agent-connections.module';
import { AgentPairController, AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';

/**
 * `POST /api/agent/pair` is unauthenticated and its only credential is a
 * short-lived pairing code, so rate limiting is the only brake on guessing one.
 * The limit is applied per client IP via {@link ThrottlerGuard}.
 */
const PAIRING_ATTEMPTS_PER_MINUTE = 20;

@Module({
  imports: [
    AgentConnectionsModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: PAIRING_ATTEMPTS_PER_MINUTE }]),
  ],
  controllers: [AgentPairController, AgentsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
