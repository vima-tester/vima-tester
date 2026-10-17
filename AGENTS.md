# AGENTS.md — vima-tester

Guidance for AI coding agents working in this repository. Read this before making changes.

## What this project is

A web-based Postman alternative for APIs on the user's own `localhost`. Browsers cannot read `localhost` responses (CORS), so requests never originate in the browser:

```
Browser (web UI) --HTTPS--> Relay server (this repo)
  --job over the agent's open WebSocket--> vima-tunneler (local agent) --HTTP--> localhost:PORT
```

This repo builds the **relay server** and the **web UI**. The local agent is a separate, fixed dependency.

## Layout and boundaries

| Path | What it is |
|---|---|
| `packages/protocol` | Wire-protocol + REST Zod schemas and types. **Single source of truth for shapes** — never redefine frame/DTO shapes elsewhere. |
| `apps/relay` | NestJS server (Prisma + PostgreSQL). Pairing, `/agent` WebSocket gateway, `/api/run` dispatch. |
| `apps/web` | React + Vite + TanStack Query + Zod. |

- `../vima-tunneler` is the sibling checkout of the agent; **do not modify it**. Its `PROTOCOL.md` is the canonical wire contract — if this file disagrees, the protocol wins.
- `packages/protocol` builds to **dual CJS + ESM + types**. `npm run build` builds it first because both apps consume `dist/`. If you edit protocol schemas, rebuild it (`npm run build -w @vima/protocol`) before typechecking/testing the apps.

## Commands

```bash
npm install
npm run build       # protocol -> relay -> web (order matters)
npm run typecheck   # all workspaces
npm test            # protocol (vitest) + relay (jest)
npm run dev         # relay :3001 + web :5173

npm run db:up       # Postgres via docker compose (host port 5434)
npm run db:migrate  # prisma migrate dev
```

Single workspace: `npm run <script> -w @vima/relay` / `@vima/web` / `@vima/protocol`.
Single relay test: `npm test -w @vima/relay -- jobs.service`.

Test runners differ by package: **protocol + web use Vitest**, **relay uses Jest** (`*.spec.ts`), the agent uses `node:test`. Don't add a new runner.

## Relay (apps/relay) notes

- **Boot requires a migrated DB.** `AgentsService.onModuleInit` loads the in-memory agent index; if the schema is missing, boot fails. Run `npm run db:migrate` (or `db:deploy`) first.
- **WS auth is synchronous and index-backed.** The agent authenticates on the upgrade via `AgentWsAdapter.create` → `verifyClient` (sync). It resolves tokens through `AgentsService`'s in-memory `tokenHash -> agent` map, not a DB query. Keep it that way — `verifyClient` cannot await.
- **Nest's WS message dispatcher is disabled on purpose.** `AgentWsAdapter.bindMessageHandlers` is a no-op because agent frames are raw protocol objects (`{type: ...}`), not Nest's `{event, data}` envelope; `AgentGateway` reads the raw socket. Do not add `@SubscribeMessage` handlers.
- **One connection per token:** a second connection for the same `agentId` replaces (closes) the first — see `AgentConnectionsService.register`.
- **Everything is scoped to the authenticated user.** Jobs resolve the caller's own connected agent (`findForUser`); never trust a client-supplied agent id.
- Config is validated at boot in `src/config/env.ts` (Zod). New env vars must be added there and to `.env.example`.

## Web protocol invariants the relay must uphold

See `../vima-tunneler/PROTOCOL.md` for the full contract. The load-bearing rules:

1. **Dedupe on `jobId`, never on `seq`.** `seq` restarts at 1 on every agent restart and delivery is at-least-once, so the same result can arrive twice. `JobsService` treats a settled `jobId` as a no-op.
2. **Ack cumulatively and inclusively** after every result: `{type:'ack', upto:<maxSeq seen>}`.
3. **Relay-side job timeouts are mandatory** (results can be lost when the agent's 1000-frame outbox overflows or the agent restarts).
4. **Handle "agent busy"** — over its concurrency cap the agent returns an `error` frame instead of queueing.
5. 401/403 on the WS upgrade is terminal for the agent; use 5xx for transient failures.
6. Ignore unparseable frames and unknown `type`s.

Relay error mapping (`JobsService.toHttpError`): `agent busy` → 503, `refusing to proxy non-local target` → 400, `timeout` → 504, timeout-at-relay → 504, anything else → 502.

## Security rules (non-negotiable)

- **Every job goes to the authenticated user's own agent only.** Never trust a client-supplied agent id without an ownership check.
- The browser never talks to `localhost` and never receives the agent token.
- Pairing codes are single-use and short-lived. Agent tokens are long-lived, stored hashed, and revocable.
- Do not log request/response bodies, `Authorization` headers, cookies, or tokens.
- Send `insecureTLS: true` only when the user explicitly enables it for that request.
- Never make the relay fetch arbitrary user-supplied URLs without an SSRF guard (block private ranges, link-local, cloud metadata addresses; re-check after DNS resolution).
- Treat agent response data as untrusted: render bodies as escaped text, never as live HTML.

## Working agreements

- Before changing protocol-related code, re-read `../vima-tunneler/PROTOCOL.md`.
- Add or update tests with every behavior change. Relay tests must keep covering: duplicate results, out-of-order acks, agent disconnect mid-job, job timeout, and cross-user agent access.
- Keep commits small and descriptive. Never commit secrets or `.env` files (only `.env.example`).
- When something is ambiguous, state the assumption in the PR/commit description.
