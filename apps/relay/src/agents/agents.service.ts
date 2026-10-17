import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AgentSummary, PairResponse, PairingCodeResponse } from '@vima/protocol';
import { PrismaService } from '../prisma/prisma.service';
import { AgentConnectionsService } from './agent-connections.service';
import { generateAgentToken, generatePairingCode, hashToken } from './tokens';

interface AgentIdentity {
  agentId: string;
  userId: string;
}

/** How often `lastSeenAt` is written to the DB per agent while connected. */
const LAST_SEEN_THROTTLE_MS = 20_000;

/**
 * Owns pairing, revocation, and an in-memory `tokenHash -> agent` index.
 *
 * The index exists so the WebSocket upgrade can authenticate *synchronously*
 * (`ws` `verifyClient` is sync) without a DB round-trip per connection. It is
 * loaded once at boot and kept current on pair/revoke.
 */
@Injectable()
export class AgentsService implements OnModuleInit {
  private readonly byTokenHash = new Map<string, AgentIdentity>();
  private readonly byAgentId = new Map<string, AgentIdentity>();
  private readonly lastSeenWrites = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly connections: AgentConnectionsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureLoaded();
  }

  async ensureLoaded(): Promise<void> {
    const agents = await this.prisma.agent.findMany({
      where: { revokedAt: null },
      select: { id: true, userId: true, tokenHash: true },
    });
    this.byTokenHash.clear();
    this.byAgentId.clear();
    for (const agent of agents) {
      const identity: AgentIdentity = { agentId: agent.id, userId: agent.userId };
      this.byTokenHash.set(agent.tokenHash, identity);
      this.byAgentId.set(agent.id, identity);
    }
  }

  /** Synchronous token check for the WS upgrade. Returns null for bad tokens. */
  authenticateToken(token: string): AgentIdentity | null {
    return this.byTokenHash.get(hashToken(token)) ?? null;
  }

  identityForAgent(agentId: string): AgentIdentity | undefined {
    return this.byAgentId.get(agentId);
  }

  async createPairingCode(userId: string): Promise<PairingCodeResponse> {
    const ttl = this.config.get<number>('PAIRING_CODE_TTL_SECONDS') ?? 600;
    const expiresAt = new Date(Date.now() + ttl * 1000);
    // Extremely unlikely to collide; retry on the unique constraint if it does.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = generatePairingCode();
      try {
        await this.prisma.pairingCode.create({
          data: { code, userId, expiresAt },
        });
        return { code, expiresAt: expiresAt.toISOString() };
      } catch (error) {
        if (attempt === 4) throw error;
      }
    }
    throw new Error('Failed to generate a pairing code');
  }

  /** Exchange a single-use pairing code for an agent id + long-lived token. */
  async pair(code: string): Promise<PairResponse> {
    const normalized = code.trim().toUpperCase();
    const record = await this.prisma.pairingCode.findUnique({ where: { code: normalized } });
    if (!record || record.usedAt !== null || record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid or expired pairing code');
    }

    const token = generateAgentToken();
    const tokenHash = hashToken(token);

    const agent = await this.prisma.$transaction(async (tx) => {
      // Mark used atomically; `updateMany` returns 0 if another request won.
      const claimed = await tx.pairingCode.updateMany({
        where: { code: normalized, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new UnauthorizedException('Pairing code already used');
      }
      return tx.agent.create({ data: { userId: record.userId, tokenHash } });
    });

    const identity: AgentIdentity = { agentId: agent.id, userId: agent.userId };
    this.byTokenHash.set(tokenHash, identity);
    this.byAgentId.set(agent.id, identity);
    return { agentId: agent.id, token };
  }

  async listAgents(userId: string): Promise<AgentSummary[]> {
    const agents = await this.prisma.agent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      createdAt: agent.createdAt.toISOString(),
      lastSeenAt: agent.lastSeenAt?.toISOString() ?? null,
      revokedAt: agent.revokedAt?.toISOString() ?? null,
      connected: this.connections.isConnected(agent.id),
    }));
  }

  async revoke(userId: string, agentId: string): Promise<void> {
    const agent = await this.prisma.agent.findFirst({ where: { id: agentId, userId } });
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }
    await this.prisma.agent.update({
      where: { id: agent.id },
      data: { revokedAt: new Date() },
    });
    this.byTokenHash.delete(agent.tokenHash);
    this.byAgentId.delete(agent.id);
    this.connections.get(agent.id)?.close();
  }

  /** Best-effort `lastSeenAt` update, throttled to avoid a write per frame. */
  touch(agentId: string): void {
    const now = Date.now();
    const last = this.lastSeenWrites.get(agentId) ?? 0;
    if (now - last < LAST_SEEN_THROTTLE_MS) return;
    this.lastSeenWrites.set(agentId, now);
    void this.prisma.agent
      .update({ where: { id: agentId }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }
}
