import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  RELAY_JOB_TIMEOUT_BUFFER_MS,
  clampAgentTimeout,
  type AgentToRelayFrame,
  type RequestFrame,
  type RunRequest,
  type RunResponse,
} from '@vima/protocol';
import { randomUUID } from 'node:crypto';
import { AgentConnectionsService } from '../agents/agent-connections.service';

interface PendingJob {
  jobId: string;
  agentId: string;
  startedAt: number;
  settled: boolean;
  timer: NodeJS.Timeout;
  resolve: (value: RunResponse) => void;
  reject: (error: Error) => void;
}

/**
 * Dispatches run requests to the caller's own connected agent and resolves them
 * from the agent's result frames.
 *
 * Key invariants (see PROTOCOL.md):
 *  - results are deduped on `jobId` (delivery is at-least-once; `seq` is not
 *    stable across agent restarts),
 *  - every pending job has its own relay-side timeout because results can be
 *    lost entirely,
 *  - acks are cumulative and handled by the connections service.
 */
@Injectable()
export class JobsService {
  private readonly pending = new Map<string, PendingJob>();

  constructor(private readonly connections: AgentConnectionsService) {}

  async run(userId: string, spec: RunRequest): Promise<RunResponse> {
    const connection = this.connections.findForUser(userId);
    if (!connection) {
      throw new ServiceUnavailableException(
        'No connected agent for this user. Start vima-tunneler and pair it from the Agents panel.',
      );
    }

    const jobId = randomUUID();
    const timeoutMs = clampAgentTimeout(spec.timeoutMs);
    const frame: RequestFrame = {
      type: 'request',
      jobId,
      method: spec.method || 'GET',
      url: spec.url,
      headers: spec.headers,
      bodyBase64: spec.body !== undefined ? Buffer.from(spec.body, 'utf8').toString('base64') : undefined,
      timeoutMs,
      insecureTLS: spec.insecureTLS === true ? true : undefined,
    };

    return new Promise<RunResponse>((resolve, reject) => {
      const relayTimeoutMs = timeoutMs + RELAY_JOB_TIMEOUT_BUFFER_MS;
      const timer = setTimeout(() => {
        this.rejectJob(
          jobId,
          new GatewayTimeoutException(`Job timed out at the relay after ${relayTimeoutMs} ms`),
        );
      }, relayTimeoutMs);
      timer.unref?.();

      this.pending.set(jobId, {
        jobId,
        agentId: connection.agentId,
        startedAt: Date.now(),
        settled: false,
        timer,
        resolve,
        reject,
      });

      try {
        connection.send(frame);
      } catch {
        this.rejectJob(jobId, new BadGatewayException('Failed to send the job to the agent'));
      }
    });
  }

  /** Called by the gateway for every parseable frame from an agent. */
  handleFrame(agentId: string, frame: AgentToRelayFrame): void {
    switch (frame.type) {
      case 'response': {
        const job = this.pending.get(frame.jobId);
        if (job && !job.settled) {
          this.resolveJob(job, {
            status: frame.status,
            headers: frame.headers,
            bodyBase64: frame.bodyBase64,
            durationMs: Date.now() - job.startedAt,
          });
        }
        this.connections.ack(agentId, frame.seq);
        break;
      }
      case 'error': {
        const job = this.pending.get(frame.jobId);
        if (job && !job.settled) {
          this.rejectJob(frame.jobId, this.toHttpError(frame.message));
        }
        this.connections.ack(agentId, frame.seq);
        break;
      }
      case 'pong':
        break;
    }
  }

  /** Fail every in-flight job for an agent that just disconnected. */
  failAgentJobs(agentId: string, reason = 'Agent disconnected mid-job'): void {
    for (const job of [...this.pending.values()]) {
      if (job.agentId === agentId && !job.settled) {
        this.rejectJob(job.jobId, new BadGatewayException(reason));
      }
    }
  }

  private resolveJob(job: PendingJob, value: RunResponse): void {
    job.settled = true;
    clearTimeout(job.timer);
    this.pending.delete(job.jobId);
    job.resolve(value);
  }

  private rejectJob(jobId: string, error: Error): void {
    const job = this.pending.get(jobId);
    if (!job || job.settled) return;
    job.settled = true;
    clearTimeout(job.timer);
    this.pending.delete(jobId);
    job.reject(error);
  }

  /** Map the agent's free-text error to an appropriate HTTP status. */
  private toHttpError(message: string): Error {
    if (message.includes('agent busy')) {
      return new ServiceUnavailableException(message);
    }
    if (message.includes('refusing to proxy non-local target')) {
      return new BadRequestException(message);
    }
    if (message.includes('timeout')) {
      return new GatewayTimeoutException(message);
    }
    return new BadGatewayException(message);
  }
}
