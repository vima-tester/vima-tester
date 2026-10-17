import { Body, Controller, Get, HttpCode, Post, UseGuards, UsePipes } from '@nestjs/common';
import { CredentialsSchema, type AuthResponse, type AuthUser, type Credentials } from '@vima/protocol';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(
    @Body(new ZodValidationPipe(CredentialsSchema)) credentials: Credentials,
  ): Promise<AuthResponse> {
    return this.auth.register(credentials.email, credentials.password);
  }

  @Post('login')
  @HttpCode(200)
  login(
    @Body(new ZodValidationPipe(CredentialsSchema)) credentials: Credentials,
  ): Promise<AuthResponse> {
    return this.auth.login(credentials.email, credentials.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser): Promise<AuthUser> {
    return this.auth.me(user.id);
  }
}
