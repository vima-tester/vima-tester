import { z } from 'zod';

/**
 * REST DTOs for the relay HTTP API, shared with the web UI so both sides agree
 * on shapes. WebSocket frames live in `./frames`.
 */

// --- Pairing ---------------------------------------------------------------

/** Agent -> relay. The pairing code is the only credential the agent holds pre-pair. */
export const PairRequestSchema = z.object({
  code: z.string().min(1),
});

export const PairResponseSchema = z.object({
  agentId: z.string(),
  token: z.string(),
});

/** User -> relay, authenticated. The web UI shows this code to the agent. */
export const PairingCodeResponseSchema = z.object({
  code: z.string(),
  expiresAt: z.string(),
});

export type PairRequest = z.infer<typeof PairRequestSchema>;
export type PairResponse = z.infer<typeof PairResponseSchema>;
export type PairingCodeResponse = z.infer<typeof PairingCodeResponseSchema>;

// --- Auth ------------------------------------------------------------------

/**
 * The browser authenticates directly against Firebase and sends the resulting
 * ID token as `Authorization: Bearer <token>`. The relay verifies it and owns
 * the database row; `AuthUser.id` is the relay's own user id, not the Firebase
 * UID (which is stored on the row).
 */
export const AuthUserSchema = z.object({
  id: z.string(),
  email: z.string(),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;

// --- Agents ----------------------------------------------------------------

export const AgentSummarySchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  createdAt: z.string(),
  lastSeenAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  connected: z.boolean(),
});

export type AgentSummary = z.infer<typeof AgentSummarySchema>;

// --- Run -------------------------------------------------------------------

export const RunRequestSchema = z.object({
  method: z.string().min(1).default('GET'),
  url: z.string().min(1),
  headers: z.record(z.string()).optional(),
  /** Raw request body as text; the relay base64-encodes it for the agent. */
  body: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
  insecureTLS: z.boolean().optional(),
});

export const RunResponseSchema = z.object({
  status: z.number(),
  headers: z.record(z.string()),
  bodyBase64: z.string(),
  /** Total time measured at the relay (includes the WebSocket hop). */
  durationMs: z.number(),
});

export const ApiErrorSchema = z.object({
  statusCode: z.number(),
  message: z.union([z.string(), z.array(z.string())]),
  error: z.string().optional(),
});

export type RunRequest = z.infer<typeof RunRequestSchema>;
export type RunResponse = z.infer<typeof RunResponseSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
