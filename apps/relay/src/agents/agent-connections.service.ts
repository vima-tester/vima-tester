import { Injectable } from '@nestjs/common';
import type { RelayToAgentFrame } from '@vima/protocol';

/** A live agent WebSocket, as seen by the rest of the relay. */
export interface AgentConnection {
  agentId: string;
  userId: string;
  send: (frame: RelayToAgentFrame) => void;
  close: () => void;
  /** Highest result `seq` seen on this connection (cumulative ack watermark). */
  maxSeq: number;
  connectedAt: number;
}

/**
 * In-memory registry of connected agents. Not persisted: connections exist only
 * for the lifetime of the process.
 */
@Injectable()
export class AgentConnectionsService {
  private readonly byAgent = new Map<string, AgentConnection>();

  register(connection: AgentConnection): void {
    const existing = this.byAgent.get(connection.agentId);
    // One connection per token: replace the old one.
    if (existing && existing !== connection) {
      existing.close();
    }
    this.byAgent.set(connection.agentId, connection);
  }

  unregister(agentId: string, connection: AgentConnection): void {
    if (this.byAgent.get(agentId) === connection) {
      this.byAgent.delete(agentId);
    }
  }

  get(agentId: string): AgentConnection | undefined {
    return this.byAgent.get(agentId);
  }

  isConnected(agentId: string): boolean {
    return this.byAgent.has(agentId);
  }

  /** Most recently connected agent for a user, if any. */
  findForUser(userId: string): AgentConnection | undefined {
    let best: AgentConnection | undefined;
    for (const connection of this.byAgent.values()) {
      if (connection.userId !== userId) continue;
      if (!best || connection.connectedAt > best.connectedAt) {
        best = connection;
      }
    }
    return best;
  }

  /** Cumulative, inclusive acknowledgement (PROTOCOL.md section 3). */
  ack(agentId: string, seq: number): void {
    const connection = this.byAgent.get(agentId);
    if (!connection) return;
    if (seq > connection.maxSeq) {
      connection.maxSeq = seq;
    }
    connection.send({ type: 'ack', upto: connection.maxSeq });
  }

  all(): AgentConnection[] {
    return [...this.byAgent.values()];
  }
}
