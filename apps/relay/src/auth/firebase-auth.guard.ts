import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthUser } from '@vima/protocol';
import type { Auth } from 'firebase-admin/auth';
import { extractBearerToken } from '../common/bearer';
import { FIREBASE_AUTH } from './firebase-admin.provider';
import { UsersService } from './users.service';

/**
 * Authenticates browser requests: verifies the Firebase ID token in the
 * `Authorization: Bearer` header, then resolves (find-or-create) the matching
 * database user and attaches it as `request.user`.
 *
 * The Firebase ID token is only used to prove identity; all authorization is
 * still scoped to the relay's own `user.id`.
 */
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    @Inject(FIREBASE_AUTH) private readonly firebase: Auth,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: AuthUser;
    }>();

    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let firebaseUid: string;
    let email: string;
    try {
      const decoded = await this.firebase.verifyIdToken(token);
      firebaseUid = decoded.uid;
      email = decoded.email ?? '';
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    request.user = await this.users.resolve(firebaseUid, email);
    return true;
  }
}
