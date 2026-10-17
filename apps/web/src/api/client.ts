import { z } from 'zod';
import {
  AgentSummarySchema,
  ApiErrorSchema,
  AuthResponseSchema,
  AuthUserSchema,
  PairingCodeResponseSchema,
  RunRequestSchema,
  RunResponseSchema,
  type AgentSummary,
  type AuthResponse,
  type AuthUser,
  type PairingCodeResponse,
  type RunRequest,
  type RunResponse,
} from '@vima/protocol';
import { getToken } from '../auth/storage';

/** Base URL of the relay. Overridable with `VITE_API_URL` at build time. */
export const API_URL: string =
  (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '') || 'http://localhost:3001';

/**
 * Dispatched on `window` whenever the relay rejects our bearer token. The auth
 * provider listens for it and drops the session, so an expired token can never
 * leave the UI in a half-signed-in state.
 */
export const UNAUTHORIZED_EVENT = 'vima:unauthorized';

/** A failed relay call: transport failures use `statusCode: 0`. */
export class ApiRequestError extends Error {
  readonly statusCode: number;
  /** Individual messages (NestJS validation can return an array). */
  readonly details: string[];

  constructor(statusCode: number, message: string, details: string[] = []) {
    super(message);
    this.name = 'ApiRequestError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function isApiRequestError(value: unknown): value is ApiRequestError {
  return value instanceof ApiRequestError;
}

interface RequestOptions {
  method?: string;
  /** JSON-serialized as the request body when present. */
  body?: unknown;
  /** Send the bearer token (default true). */
  auth?: boolean;
  signal?: AbortSignal;
}

function messageFromApiError(error: z.infer<typeof ApiErrorSchema>): string {
  return Array.isArray(error.message) ? error.message.join(', ') : error.message;
}

function detailsFromApiError(error: z.infer<typeof ApiErrorSchema>): string[] {
  return Array.isArray(error.message) ? error.message : [];
}

/**
 * Turn a non-OK response into an `ApiRequestError`.
 *
 * The body is parsed with `ApiErrorSchema` when possible and never logged: an
 * error body can echo back request data.
 */
async function errorFromResponse(response: Response): Promise<ApiRequestError> {
  const fallback = `${response.status} ${response.statusText}`.trim();
  const raw = await response.text().catch(() => '');
  if (!raw) return new ApiRequestError(response.status, fallback);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return new ApiRequestError(response.status, raw.slice(0, 500));
  }

  const parsed = ApiErrorSchema.safeParse(parsedJson);
  if (!parsed.success) return new ApiRequestError(response.status, raw.slice(0, 500));

  return new ApiRequestError(
    response.status,
    messageFromApiError(parsed.data) || fallback,
    detailsFromApiError(parsed.data),
  );
}

/**
 * Single fetch wrapper: attaches the bearer token, maps errors, and validates
 * the payload against the shared `@vima/protocol` schema before returning it.
 */
export async function request<T>(
  path: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const token = getToken();
  if (options.auth !== false && token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiRequestError(
      0,
      `Cannot reach the relay at ${API_URL}. Is it running?`,
    );
  }

  if (response.status === 401 && options.auth !== false) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }

  if (!response.ok) throw await errorFromResponse(response);

  // Read as text first so a 204 (or any empty body) is handled without a
  // JSON-parse failure.
  const text = await response.text().catch(() => '');
  if (!text) {
    const empty = schema.safeParse(undefined);
    if (empty.success) return empty.data;
    throw new ApiRequestError(response.status, 'The relay returned an empty response.');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new ApiRequestError(response.status, 'The relay returned a non-JSON response.');
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiRequestError(
      response.status,
      'The relay returned an unexpected response shape.',
      parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    );
  }
  return parsed.data;
}

// --- Auth ------------------------------------------------------------------

export function register(email: string, password: string): Promise<AuthResponse> {
  return request('/api/auth/register', AuthResponseSchema, {
    method: 'POST',
    body: { email, password },
    auth: false,
  });
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return request('/api/auth/login', AuthResponseSchema, {
    method: 'POST',
    body: { email, password },
    auth: false,
  });
}

export function fetchMe(): Promise<AuthUser> {
  return request('/api/auth/me', AuthUserSchema);
}

// --- Agents ----------------------------------------------------------------

export function createPairingCode(): Promise<PairingCodeResponse> {
  return request('/api/agents/pairing-codes', PairingCodeResponseSchema, { method: 'POST' });
}

export function listAgents(): Promise<AgentSummary[]> {
  return request('/api/agents', z.array(AgentSummarySchema));
}

export async function revokeAgent(id: string): Promise<void> {
  await request(`/api/agents/${encodeURIComponent(id)}`, z.unknown(), { method: 'DELETE' });
}

// --- Run -------------------------------------------------------------------

/**
 * Send a request through the relay to the caller's own paired agent.
 *
 * The payload is validated locally first so the UI fails fast on an invalid
 * method/URL instead of round-tripping to the relay.
 */
export function runRequest(runRequestInput: RunRequest): Promise<RunResponse> {
  const payload = RunRequestSchema.parse(runRequestInput);
  return request('/api/run', RunResponseSchema, { method: 'POST', body: payload });
}
