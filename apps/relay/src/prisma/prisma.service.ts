import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** Bounded retry budget for the boot-time connection (covers a cold/suspended DB). */
const CONNECT_ATTEMPTS = 15;
const CONNECT_BASE_DELAY_MS = 250;
const CONNECT_MAX_DELAY_MS = 2_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Connects to PostgreSQL on boot. `onModuleInit` runs before the HTTP server
 * starts listening, so the process only begins serving once the database is
 * reachable and the schema is in place.
 *
 * The connection is retried a bounded number of times with backoff, because a
 * hosted/autosuspending database (e.g. Neon) can briefly refuse the first
 * connection. After the budget is exhausted the error is rethrown, failing
 * startup fast rather than serving requests against a dead database.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readyPromise: Promise<void> | null = null;

  onModuleInit(): Promise<void> {
    this.readyPromise = this.connectWithRetry();
    return this.readyPromise;
  }

  /**
   * Resolves once the startup connection has succeeded. Other providers await
   * this in their own `onModuleInit` so a database query never races the
   * connection (Nest runs module-init hooks concurrently).
   */
  ready(): Promise<void> {
    return this.readyPromise ?? Promise.resolve();
  }

  private async connectWithRetry(): Promise<void> {
    for (let attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt += 1) {
      try {
        await this.$connect();
        // Cheap round-trip so a dead or unmigrated database fails here, not on
        // the first request.
        await this.$queryRaw`SELECT 1`;
        this.logger.log(
          attempt === 1 ? 'connected to the database' : `connected to the database after ${attempt} attempts`,
        );
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt === CONNECT_ATTEMPTS) {
          this.logger.error(
            `could not connect to the database after ${CONNECT_ATTEMPTS} attempts: ${message}`,
          );
          this.logger.error(
            'Check DATABASE_URL and that the database is running; run `npm run db:migrate` (or `db:deploy`) to create the schema.',
          );
          throw error;
        }
        const delay = Math.min(CONNECT_MAX_DELAY_MS, CONNECT_BASE_DELAY_MS * attempt);
        this.logger.warn(
          `database not reachable (attempt ${attempt}/${CONNECT_ATTEMPTS}): ${message} - retrying in ${delay} ms`,
        );
        await sleep(delay);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
