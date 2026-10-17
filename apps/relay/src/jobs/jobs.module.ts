import { Module } from '@nestjs/common';
import { AgentConnectionsModule } from '../agents/agent-connections.module';
import { JobsService } from './jobs.service';
import { RunController } from './run.controller';

@Module({
  imports: [AgentConnectionsModule],
  controllers: [RunController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
