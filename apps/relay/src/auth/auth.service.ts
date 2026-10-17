import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { AuthResponse, AuthUser } from '@vima/protocol';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

const BCRYPT_ROUNDS = 12;

interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(email: string, password: string): Promise<AuthResponse> {
    const normalized = email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (existing) {
      throw new ConflictException('An account with that email already exists');
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email: normalized, passwordHash },
    });
    return this.issue(user.id, user.email);
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalized } });
    // Always run a compare to avoid leaking whether the email exists.
    const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issue(user.id, user.email);
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    return { id: user.id, email: user.email };
  }

  private issue(id: string, email: string): AuthResponse {
    const payload: JwtPayload = { sub: id, email };
    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN'),
    });
    return { accessToken, user: { id, email } };
  }
}
