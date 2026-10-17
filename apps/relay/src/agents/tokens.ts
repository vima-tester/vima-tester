import { createHash, randomBytes } from 'node:crypto';

/** Long-lived agent token. Shown to the agent once, stored only as a hash. */
export function generateAgentToken(): string {
  return randomBytes(32).toString('hex');
}

/** SHA-256 of a token, used as the lookup key in the token index. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Single-use, short-lived pairing code shown in the web UI. */
export function generatePairingCode(): string {
  return randomBytes(4).toString('hex').toUpperCase();
}
