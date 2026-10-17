import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AgentConnectionsModule } from './agents/agent-connections.module';
import { AgentsModule } from './agents/agents.module';
import { AgentGatewayModule } from './agents/agent-gateway.module';
import { JobsModule } from './jobs/jobs.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: ['.env'],
    }),
    PrismaModule,
    AuthModule,
    AgentConnectionsModule,
    AgentsModule,
    JobsModule,
    AgentGatewayModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
