import { Module } from '@nestjs/common';
import { AgentConnectionsService } from './agent-connections.service';

@Module({
  providers: [AgentConnectionsService],
  exports: [AgentConnectionsService],
})
export class AgentConnectionsModule {}
