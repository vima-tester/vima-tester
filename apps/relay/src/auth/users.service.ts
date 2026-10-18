import { Injectable } from '@nestjs/common';
import type { AuthUser } from '@vima/protocol';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Owns the application's `User` rows. The identity comes from Firebase: `uid`
 * is the Firebase UID and is the stable key; the row's own `id` is what the
 * rest of the relay (agents, jobs) references.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find-or-create the user for a verified Firebase identity. Email is kept in
   * sync (rare) without writing on every request.
   */
  async resolve(firebaseUid: string, email: string): Promise<AuthUser> {
    const existing = await this.prisma.user.findUnique({
      where: { firebaseUid },
      select: { id: true, email: true },
    });

    if (existing) {
      if (email && existing.email !== email) {
        return this.prisma.user.update({
          where: { firebaseUid },
          data: { email },
          select: { id: true, email: true },
        });
      }
      return existing;
    }

    return this.prisma.user.create({
      data: { firebaseUid, email },
      select: { id: true, email: true },
    });
  }
}
