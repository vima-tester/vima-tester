import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { RunRequestSchema, type AuthUser, type RunRequest, type RunResponse } from '@vima/protocol';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JobsService } from './jobs.service';

@Controller('api/run')
@UseGuards(FirebaseAuthGuard)
export class RunController {
  constructor(private readonly jobs: JobsService) {}

  @Post()
  @HttpCode(200)
  run(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(RunRequestSchema)) spec: RunRequest,
  ): Promise<RunResponse> {
    return this.jobs.run(user.id, spec);
  }
}
