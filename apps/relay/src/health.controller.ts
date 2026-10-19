import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

/**
 * Readiness probe. Unlike a bare liveness ping it round-trips the database, so
 * a load balancer stops routing to an instance whose DB connection has died.
 */
@Controller('api/health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ status: string; database: string }> {
    try {
      await this.prisma.ready();
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'unreachable' });
    }
    return { status: 'ok', database: 'ok' };
  }
}
