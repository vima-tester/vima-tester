import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  PairRequestSchema,
  type AgentSummary,
  type AuthUser,
  type PairRequest,
  type PairResponse,
  type PairingCodeResponse,
} from '@vima/protocol';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AgentsService } from './agents.service';

/**
 * Public endpoint the local agent calls during pairing. Its only credential is
 * the single-use pairing code, so it is intentionally unauthenticated.
 */
@Controller('api/agent')
@UseGuards(ThrottlerGuard)
export class AgentPairController {
  constructor(private readonly agents: AgentsService) {}

  @Post('pair')
  @HttpCode(200)
  pair(@Body(new ZodValidationPipe(PairRequestSchema)) body: PairRequest): Promise<PairResponse> {
    return this.agents.pair(body.code);
  }
}

@Controller('api/agents')
@UseGuards(FirebaseAuthGuard)
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  /** Generate the single-use code shown in the web UI and typed into the agent. */
  @Post('pairing-codes')
  createPairingCode(@CurrentUser() user: AuthUser): Promise<PairingCodeResponse> {
    return this.agents.createPairingCode(user.id);
  }

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<AgentSummary[]> {
    return this.agents.listAgents(user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  async revoke(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.agents.revoke(user.id, id);
  }
}
