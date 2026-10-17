import { describe, expect, it } from 'vitest';
import {
  AckFrameSchema,
  AgentToRelayFrameSchema,
  ResponseFrameSchema,
  RequestFrameSchema,
  RelayToAgentFrameSchema,
} from '../src/frames';
import { clampAgentTimeout } from '../src/constants';

describe('frames', () => {
  it('accepts a minimal request frame', () => {
    const parsed = RequestFrameSchema.parse({ type: 'request', jobId: 'abc' });
    expect(parsed.jobId).toBe('abc');
  });

  it('rejects a request frame without a jobId', () => {
    expect(RequestFrameSchema.safeParse({ type: 'request' }).success).toBe(false);
  });

  it('parses an agent response frame', () => {
    const frame = {
      type: 'response',
      jobId: 'j1',
      status: 200,
      headers: { 'content-type': 'application/json' },
      bodyBase64: 'e30=',
      seq: 7,
    };
    expect(ResponseFrameSchema.parse(frame)).toMatchObject({ status: 200, seq: 7 });
  });

  it('ignores unknown frame types via the discriminated unions', () => {
    expect(AgentToRelayFrameSchema.safeParse({ type: 'mystery' }).success).toBe(false);
    expect(RelayToAgentFrameSchema.safeParse({ type: 'mystery' }).success).toBe(false);
  });

  it('parses an ack frame', () => {
    expect(AckFrameSchema.parse({ type: 'ack', upto: 3 })).toEqual({ type: 'ack', upto: 3 });
  });
});

describe('clampAgentTimeout', () => {
  it('defaults when unset', () => {
    expect(clampAgentTimeout(undefined)).toBe(30_000);
  });

  it('clamps below the minimum', () => {
    expect(clampAgentTimeout(10)).toBe(1_000);
  });

  it('clamps above the maximum', () => {
    expect(clampAgentTimeout(10_000_000)).toBe(300_000);
  });

  it('passes through in-range values', () => {
    expect(clampAgentTimeout(5_000)).toBe(5_000);
  });

  it('defaults on non-finite input', () => {
    expect(clampAgentTimeout(Number.NaN)).toBe(30_000);
  });
});
