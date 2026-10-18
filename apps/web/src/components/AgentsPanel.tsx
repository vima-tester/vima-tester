import { useState } from 'react';
import type { AgentSummary } from '@vima/protocol';
import { ApiRequestError } from '../api/client';
import { useAgents, useCreatePairingCode, useRevokeAgent } from '../api/hooks';

function formatRelative(iso: string | null): string {
  if (!iso) return 'never';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return iso;

  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(then).toLocaleString();
}

function errorMessage(error: unknown): string | null {
  if (!error) return null;
  return error instanceof ApiRequestError ? error.message : 'Something went wrong.';
}

function AgentRow({ agent, onRevoke, revoking }: {
  agent: AgentSummary;
  onRevoke: (id: string) => void;
  revoking: boolean;
}) {
  const revoked = agent.revokedAt !== null;

  return (
    <li className={`agent-row ${revoked ? 'revoked' : ''}`}>
      <span
        className={`dot ${agent.connected && !revoked ? 'dot-on' : 'dot-off'}`}
        aria-hidden="true"
      />
      <div className="agent-info">
        <span className="agent-name">{agent.name ?? 'Unnamed agent'}</span>
        <span className="muted small">
          {revoked ? 'revoked' : agent.connected ? 'connected' : 'not connected'} · last seen{' '}
          {formatRelative(agent.lastSeenAt)}
        </span>
        <span className="muted small mono" title={agent.id}>
          {agent.id}
        </span>
      </div>
      <button
        className="button small danger"
        type="button"
        onClick={() => onRevoke(agent.id)}
        disabled={revoked || revoking}
      >
        {revoked ? 'Revoked' : 'Revoke'}
      </button>
    </li>
  );
}

export function AgentsPanel() {
  const agents = useAgents();
  const createPairingCode = useCreatePairingCode();
  const revokeAgent = useRevokeAgent();
  const [copied, setCopied] = useState(false);

  const pairing = createPairingCode.data;

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable; the code is shown in a selectable input too.
      setCopied(false);
    }
  }

  return (
    <div className="card agents-panel">
      <div className="subsection-head">
        <h2>Agents</h2>
        <button
          className="button small primary"
          type="button"
          onClick={() => {
            setCopied(false);
            createPairingCode.mutate();
          }}
          disabled={createPairingCode.isPending}
        >
          {createPairingCode.isPending ? 'Generating…' : 'Generate pairing code'}
        </button>
      </div>

      <p className="muted small">
        Run the local agent and give it a pairing code. Codes are single-use and short-lived.{' '}
        <a href="/docs#pair">How to pair →</a>
      </p>

      {pairing && (
        <div className="pairing-code">
          <input className="mono" readOnly value={pairing.code} aria-label="Pairing code" />
          <button className="button small" type="button" onClick={() => void copyCode(pairing.code)}>
            {copied ? 'Copied' : 'Copy'}
          </button>
          <span className="muted small">
            expires {new Date(pairing.expiresAt).toLocaleTimeString()} (
            {formatRelative(pairing.expiresAt)})
          </span>
        </div>
      )}

      {errorMessage(createPairingCode.error) && (
        <p className="alert alert-error" role="alert">
          {errorMessage(createPairingCode.error)}
        </p>
      )}

      <div className="subsection">
        {agents.isPending && <p className="muted">Loading agents…</p>}

        {agents.isError && (
          <p className="alert alert-error" role="alert">
            {errorMessage(agents.error) ?? 'Could not load agents.'}
          </p>
        )}

        {agents.data && agents.data.length === 0 && (
          <p className="muted small">No agents paired yet.</p>
        )}

        {agents.data && agents.data.length > 0 && (
          <ul className="agent-list">
            {agents.data.map((agent) => (
              <AgentRow
                key={agent.id}
                agent={agent}
                onRevoke={(id) => revokeAgent.mutate(id)}
                revoking={revokeAgent.isPending && revokeAgent.variables === agent.id}
              />
            ))}
          </ul>
        )}

        {errorMessage(revokeAgent.error) && (
          <p className="alert alert-error" role="alert">
            {errorMessage(revokeAgent.error)}
          </p>
        )}
      </div>
    </div>
  );
}
