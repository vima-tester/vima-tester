/**
 * Protocol constants shared by the relay and the web UI.
 *
 * These mirror the guarantees documented in vima-tunneler's PROTOCOL.md.
 * That document (and the agent's implementation) is the source of truth; if a
 * value here drifts, fix it here.
 */

/** Hostnames the agent will proxy. Anything else yields an `error` frame. */
export const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '::1', '0.0.0.0'] as const;

/** Per-job timeout bounds enforced by the agent. */
export const AGENT_TIMEOUT_MIN_MS = 1_000;
export const AGENT_TIMEOUT_MAX_MS = 300_000;
export const AGENT_TIMEOUT_DEFAULT_MS = 30_000;

/** Response body cap enforced by the agent (25 MiB). */
export const AGENT_MAX_BODY_BYTES = 26_214_400;

/** Default concurrency cap (`VIMA_MAX_INFLIGHT` on the agent). */
export const AGENT_MAX_INFLIGHT_DEFAULT = 8;

/**
 * Extra time the relay adds on top of a job's `timeoutMs` before it gives up,
 * covering the WebSocket hop and agent-side overhead.
 */
export const RELAY_JOB_TIMEOUT_BUFFER_MS = 2_000;

/** How often the relay pings idle agent connections (agent drops after ~60s). */
export const RELAY_PING_INTERVAL_MS = 25_000;

/** Clamp a requested timeout the same way the agent does. */
export function clampAgentTimeout(ms: number | undefined | null): number {
  if (ms === undefined || ms === null || !Number.isFinite(ms)) {
    return AGENT_TIMEOUT_DEFAULT_MS;
  }
  return Math.min(AGENT_TIMEOUT_MAX_MS, Math.max(AGENT_TIMEOUT_MIN_MS, Math.floor(ms)));
}
