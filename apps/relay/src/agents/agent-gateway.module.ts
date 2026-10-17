import { Module } from '@nestjs/common';
import { AgentsModule } from './agents.module';
import { AgentConnectionsModule } from './agent-connections.module';
import { AgentGateway } from './agent.gateway';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [AgentsModule, AgentConnectionsModule, JobsModule],
  providers: [AgentGateway],
})
export class AgentGatewayModule {}
