import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@vima/protocol';

/** Reads the authenticated user attached by `FirebaseAuthGuard`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
