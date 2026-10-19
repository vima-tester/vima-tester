import { z } from 'zod';

/**
 * Environment schema. Validated once at boot via `ConfigModule.forRoot`, so a
 * misconfigured relay fails fast instead of failing on the first request.
 */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  PAIRING_CODE_TTL_SECONDS: z.coerce.number().int().positive().default(600),

  // Upper bound for request bodies the relay accepts. Express' 100 kB default is
  // too small for API payloads; the agent caps *response* bodies separately.
  MAX_REQUEST_BODY_BYTES: z.coerce.number().int().positive().default(26_214_400),

  // Set "true" when running behind a trusted reverse proxy so rate limiting and
  // logs use the client IP from `X-Forwarded-For` instead of the proxy socket.
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  // Firebase Admin service-account credentials, used to verify browser ID
  // tokens. Mirrors the Firebase web config used by apps/web.
  FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
  FIREBASE_CLIENT_EMAIL: z.string().min(1, 'FIREBASE_CLIENT_EMAIL is required'),
  FIREBASE_PRIVATE_KEY: z.string().min(1, 'FIREBASE_PRIVATE_KEY is required'),
});

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = EnvSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return parsed.data;
}
