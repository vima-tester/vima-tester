import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@vima/protocol';
import { CurrentUser } from '../common/current-user.decorator';
import { FirebaseAuthGuard } from './firebase-auth.guard';

/**
 * The browser signs in with Firebase directly (Google or email/password); the
 * relay never sees a password. This endpoint just returns the relay-side user
 * row resolved from the verified Firebase ID token.
 */
@Controller('api/auth')
export class AuthController {
  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}
