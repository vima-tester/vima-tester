import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Auth } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import type { UsersService } from './users.service';

function contextWith(authorization?: string): {
  context: ExecutionContext;
  request: { headers: Record<string, string | undefined>; user?: unknown };
} {
  const request: { headers: Record<string, string | undefined>; user?: unknown } = {
    headers: authorization ? { authorization } : {},
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

function makeGuard(
  verifyIdToken: jest.Mock,
  resolve: jest.Mock = jest.fn((_uid: string, email: string) =>
    Promise.resolve({ id: 'db-user-1', email }),
  ),
): { guard: FirebaseAuthGuard; resolve: jest.Mock } {
  const auth = { verifyIdToken } as unknown as Auth;
  const users = { resolve } as unknown as UsersService;
  return { guard: new FirebaseAuthGuard(auth, users), resolve };
}

describe('FirebaseAuthGuard', () => {
  it('rejects a request with no bearer token', async () => {
    const { guard } = makeGuard(jest.fn());
    await expect(guard.canActivate(contextWith().context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an invalid or expired token', async () => {
    const { guard } = makeGuard(jest.fn().mockRejectedValue(new Error('expired')));
    await expect(guard.canActivate(contextWith('Bearer bad').context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('resolves the database user and attaches it for a valid token', async () => {
    const { guard, resolve } = makeGuard(
      jest.fn().mockResolvedValue({ uid: 'firebase-uid-1', email: 'user@example.com' }),
    );
    const { context, request } = contextWith('Bearer good');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(resolve).toHaveBeenCalledWith('firebase-uid-1', 'user@example.com');
    expect(request.user).toEqual({ id: 'db-user-1', email: 'user@example.com' });
  });

  it('tolerates a token without an email claim', async () => {
    const { guard, resolve } = makeGuard(jest.fn().mockResolvedValue({ uid: 'firebase-uid-2' }));
    const { context } = contextWith('Bearer good');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(resolve).toHaveBeenCalledWith('firebase-uid-2', '');
  });
});
