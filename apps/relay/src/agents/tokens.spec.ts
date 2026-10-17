import { createHash } from 'node:crypto';
import { generateAgentToken, generatePairingCode, hashToken } from './tokens';

describe('agent tokens', () => {
  it('generates a 32-byte hex token', () => {
    const token = generateAgentToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates distinct tokens', () => {
    expect(generateAgentToken()).not.toEqual(generateAgentToken());
  });

  it('hashes deterministically with sha256', () => {
    const token = 'abc123';
    expect(hashToken(token)).toBe(createHash('sha256').update(token).digest('hex'));
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it('generates an 8-char uppercase hex pairing code', () => {
    expect(generatePairingCode()).toMatch(/^[0-9A-F]{8}$/);
  });
});
