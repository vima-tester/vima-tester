import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { IncomingMessage } from 'node:http';
import WebSocket from 'ws';
import {
  AgentToRelayFrameSchema,
  RELAY_PING_INTERVAL_MS,
  type RelayToAgentFrame,
} from '@vima/protocol';
import { AgentsService } from './agents.service';
import { AgentConnectionsService, type AgentConnection } from './agent-connections.service';
import { JobsService } from '../jobs/jobs.service';

interface AuthenticatedRequest extends IncomingMessage {
  agentId?: string;
  userId?: string;
}

/**
 * The `/agent` WebSocket endpoint. Authentication happens earlier, in
 * `AgentWsAdapter.create` (on the upgrade); by the time a connection reaches
 * here it carries `agentId`/`userId`.
 */
@Injectable()
@WebSocketGateway({ path: '/agent' })
export class AgentGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AgentGateway.name);
  private readonly agentIdBySocket = new WeakMap<WebSocket, string>();
  private readonly connectionBySocket = new WeakMap<WebSocket, AgentConnection>();
  private heartbeat?: NodeJS.Timeout;

  constructor(
    private readonly agents: AgentsService,
    private readonly connections: AgentConnectionsService,
    private readonly jobs: JobsService,
  ) {}

  onModuleInit(): void {
    this.heartbeat = setInterval(() => {
      for (const connection of this.connections.all()) {
        connection.send({ type: 'ping' });
      }
    }, RELAY_PING_INTERVAL_MS);
    this.heartbeat.unref?.();
  }

  onModuleDestroy(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
  }

  handleConnection(client: WebSocket, request: IncomingMessage): void {
    const { agentId } = request as AuthenticatedRequest;
    const identity = agentId ? this.agents.identityForAgent(agentId) : undefined;
    if (!agentId || !identity) {
      client.close(4401, 'Unauthorized');
      return;
    }

    const connection: AgentConnection = {
      agentId,
      userId: identity.userId,
      maxSeq: 0,
      connectedAt: Date.now(),
      send: (frame: RelayToAgentFrame) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(frame));
        }
      },
      close: () => client.close(4409, 'Replaced by a newer connection'),
    };

    this.agentIdBySocket.set(client, agentId);
    this.connectionBySocket.set(client, connection);
    this.connections.register(connection);
    this.agents.touch(agentId);
    this.logger.log(`agent ${agentId} connected (user ${identity.userId})`);

    client.on('message', (raw: unknown) => {
      this.onMessage(agentId, String(raw));
    });
  }

  handleDisconnect(client: WebSocket): void {
    const agentId = this.agentIdBySocket.get(client);
    const connection = this.connectionBySocket.get(client);
    if (!agentId || !connection) return;
    this.connections.unregister(agentId, connection);
    this.jobs.failAgentJobs(agentId);
    this.agents.touch(agentId);
    this.logger.log(`agent ${agentId} disconnected`);
  }

  private onMessage(agentId: string, raw: string): void {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return; // ignore unparseable frames
    }
    const parsed = AgentToRelayFrameSchema.safeParse(json);
    if (!parsed.success) {
      return; // ignore unknown `type` values and malformed frames
    }
    this.agents.touch(agentId);
    this.jobs.handleFrame(agentId, parsed.data);
  }
}
