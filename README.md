# vima-tester

A web-based Postman alternative for testing APIs on your own `localhost`.

Browsers cannot read responses from `localhost` APIs (CORS), so requests never
originate in the browser. Instead the relay hands each job to the
[`vima-tunneler`](../vima-tunneler) agent running on your machine, which makes
the real HTTP call:

```
Browser (web UI) --HTTPS--> Relay server (this repo)
  --job over the agent's WebSocket--> vima-tunneler (local agent) --HTTP--> localhost:PORT
```

## Layout

| Path | What it is |
|---|---|
| `apps/relay` | NestJS relay server: pairing, the `/agent` WebSocket gateway, and the `/api/run` job dispatch API. Prisma + PostgreSQL. |
| `apps/web` | React + Vite web UI (TanStack Query + Zod). |
| `packages/protocol` | Wire-protocol and REST schemas shared by both apps. Source of truth lives in `../vima-tunneler/PROTOCOL.md`. |

## Prerequisites

- Node.js >= 20
- Docker (for the local Postgres), or any PostgreSQL 16 instance

## Setup

```bash
npm install

# Start Postgres (host port 5434, see docker-compose.yml)
npm run db:up

# Configure the relay, then create the schema
cp .env.example apps/relay/.env      # edit JWT_SECRET / DATABASE_URL if needed
npm run db:migrate                   # prisma migrate dev

npm run dev                          # relay :3001 + web :5173
```

Open http://localhost:5173, register an account, then in the **Agents** panel
generate a pairing code and run it through the agent:

```bash
vima-tunneler pair --code <code> --server http://localhost:3001
vima-tunneler start
```

## Commands

```bash
npm run build       # build protocol -> relay -> web (order matters)
npm test            # protocol (vitest) + relay (jest) unit tests
npm run typecheck   # all workspaces
npm run dev         # relay + web together
npm run db:migrate  # prisma migrate dev (relay)
```

Run a single workspace: `npm run <script> -w @vima/relay` (or `@vima/web`,
`@vima/protocol`). Run one relay test:
`npm test -w @vima/relay -- jobs.service`.

## Security model

Every job is dispatched to the authenticated user's *own* paired agent; the
browser never talks to `localhost` and never sees the agent token. See
`AGENTS.md` for the full list of non-negotiable rules.
