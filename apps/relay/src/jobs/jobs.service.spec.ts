import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { RelayToAgentFrame } from '@vima/protocol';
import type { AgentConnection, AgentConnectionsService } from '../agents/agent-connections.service';
import { JobsService } from './jobs.service';

interface Harness {
  jobs: JobsService;
  sent: RelayToAgentFrame[];
}

function createHarness(connected = true): Harness {
  const sent: RelayToAgentFrame[] = [];
  const connection: AgentConnection = {
    agentId: 'agent-1',
    userId: 'user-1',
    maxSeq: 0,
    connectedAt: Date.now(),
    send: (frame) => sent.push(frame),
    close: () => undefined,
  };
  const connections = {
    findForUser: (userId: string) => (connected && userId === 'user-1' ? connection : undefined),
    ack: jest.fn(),
  } as unknown as AgentConnectionsService;
  return { jobs: new JobsService(connections), sent };
}

function lastJobId(sent: RelayToAgentFrame[]): string {
  const frame = sent[sent.length - 1];
  if (frame.type !== 'request') throw new Error('last frame was not a request');
  return frame.jobId;
}

describe('JobsService', () => {
  it('rejects when the user has no connected agent', async () => {
    const { jobs } = createHarness(false);
    await expect(
      jobs.run('user-1', { method: 'GET', url: 'http://localhost:3000' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('resolves a job from a response frame and base64-encodes the request body', async () => {
    const { jobs, sent } = createHarness();
    void jobs.run('user-1', { method: 'POST', url: 'http://localhost:3000', body: 'hello' });
    const request = sent[0];
    expect(request).toMatchObject({
      type: 'request',
      method: 'POST',
      bodyBase64: Buffer.from('hello').toString('base64'),
    });

    const jobId = lastJobId(sent);
    jobs.handleFrame('agent-1', {
      type: 'response',
      jobId,
      status: 200,
      headers: { 'content-type': 'application/json' },
      bodyBase64: 'e30=',
      seq: 1,
    });
    // Give the promise a tick to settle.
    await Promise.resolve();
  });

  it('resolves with the response payload', async () => {
    const { jobs, sent } = createHarness();
    const promise = jobs.run('user-1', { method: 'GET', url: 'http://localhost:3000' });
    jobs.handleFrame('agent-1', {
      type: 'response',
      jobId: lastJobId(sent),
      status: 201,
      headers: { 'x-test': '1' },
      bodyBase64: 'e30=',
      seq: 1,
    });
    await expect(promise).resolves.toMatchObject({ status: 201, bodyBase64: 'e30=' });
  });

  it('dedupes repeated results for the same jobId', async () => {
    const { jobs, sent } = createHarness();
    const promise = jobs.run('user-1', { method: 'GET', url: 'http://localhost:3000' });
    const jobId = lastJobId(sent);
    const frame = {
      type: 'response' as const,
      jobId,
      status: 200,
      headers: {},
      bodyBase64: '',
      seq: 1,
    };
    jobs.handleFrame('agent-1', frame);
    // A replay after settlement must be a harmless no-op.
    expect(() => jobs.handleFrame('agent-1', { ...frame, seq: 2 })).not.toThrow();
    await expect(promise).resolves.toMatchObject({ status: 200 });
  });

  it('maps "agent busy" errors to 503', async () => {
    const { jobs, sent } = createHarness();
    const promise = jobs.run('user-1', { method: 'GET', url: 'http://localhost:3000' });
    jobs.handleFrame('agent-1', {
      type: 'error',
      jobId: lastJobId(sent),
      message: 'agent busy: 8 jobs already in flight',
      seq: 1,
    });
    await expect(promise).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('maps non-local target errors to 400', async () => {
    const { jobs, sent } = createHarness();
    const promise = jobs.run('user-1', { method: 'GET', url: 'https://example.com' });
    jobs.handleFrame('agent-1', {
      type: 'error',
      jobId: lastJobId(sent),
      message: 'refusing to proxy non-local target: https://example.com',
      seq: 1,
    });
    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
  });

  it('times out when no result arrives', async () => {
    jest.useFakeTimers();
    try {
      const { jobs } = createHarness();
      const promise = jobs.run('user-1', {
        method: 'GET',
        url: 'http://localhost:3000',
        timeoutMs: 1000,
      });
      const assertion = expect(promise).rejects.toBeInstanceOf(GatewayTimeoutException);
      jest.advanceTimersByTime(1000 + 2000 + 1);
      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });

  it('fails in-flight jobs when the agent disconnects', async () => {
    const { jobs, sent } = createHarness();
    const promise = jobs.run('user-1', { method: 'GET', url: 'http://localhost:3000' });
    jobs.handleFrame('agent-1', { type: 'pong' });
    jobs.failAgentJobs('agent-1');
    await expect(promise).rejects.toBeInstanceOf(BadGatewayException);
    // sanity: the request actually went out
    expect(lastJobId(sent)).toBeDefined();
  });
});
