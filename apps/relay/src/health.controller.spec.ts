import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import type { PrismaService } from './prisma/prisma.service';

function makeController(overrides: {
  ready?: () => Promise<void>;
  query?: () => Promise<unknown>;
}): HealthController {
  const prisma = {
    ready: overrides.ready ?? (() => Promise.resolve()),
    $queryRaw: overrides.query ?? (() => Promise.resolve([{ '?column?': 1 }])),
  } as unknown as PrismaService;
  return new HealthController(prisma);
}

describe('HealthController', () => {
  it('reports ok when the database responds', async () => {
    await expect(makeController({}).check()).resolves.toEqual({
      status: 'ok',
      database: 'ok',
    });
  });

  it('throws 503 when the database is unreachable', async () => {
    const controller = makeController({ query: () => Promise.reject(new Error('down')) });
    await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
