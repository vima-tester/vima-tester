import { Module } from '@nestjs/common';
import { AgentConnectionsModule } from './agent-connections.module';
import { AgentPairController, AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';

@Module({
  imports: [AgentConnectionsModule],
  controllers: [AgentPairController, AgentsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
