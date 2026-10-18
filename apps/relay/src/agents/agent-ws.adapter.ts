import { INestApplicationContext } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import type { IncomingMessage } from 'node:http';
import { AgentsService } from './agents.service';
import { extractBearerToken } from '../common/bearer';

interface UpgradeRequest extends IncomingMessage {
  agentId?: string;
  userId?: string;
}

type VerifyClientCallback = (result: boolean, code?: number, message?: string) => void;

/**
 * `WsAdapter` with two changes the protocol requires:
 *
 *  1. Authenticate the token on the **upgrade request** and reject bad tokens
 *     with HTTP 401. `verifyClient` is synchronous, which is why the relay keeps
 *     an in-memory `tokenHash -> agent` index (see `AgentsService`).
 *  2. Disable Nest's event-based message dispatcher. Agent frames are raw
 *     protocol objects (`{type: ...}`), not Nest's `{event, data}` envelope, so
 *     the gateway reads the raw socket instead.
 */
export class AgentWsAdapter extends WsAdapter {
  constructor(private readonly applicationRef: INestApplicationContext) {
    super(applicationRef);
  }

  create(port: number, options: Record<string, unknown> = {}): unknown {
    const agents = this.applicationRef.get(AgentsService, { strict: false });

    const verifyClient = (
      info: { req: IncomingMessage },
      callback: VerifyClientCallback,
    ): void => {
      const request = info.req as UpgradeRequest;
      const token = extractBearerToken(request.headers.authorization);
      const identity = token ? agents.authenticateToken(token) : null;
      if (!identity) {
        callback(false, 401, 'Unauthorized');
        return;
      }
      request.agentId = identity.agentId;
      request.userId = identity.userId;
      callback(true);
    };

    return super.create(port, { ...options, verifyClient });
  }

  bindMessageHandlers(): void {
    // Intentionally empty: the gateway handles raw frames itself.
  }
}
