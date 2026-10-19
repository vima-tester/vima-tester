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
- Any reachable PostgreSQL 16 instance (local server or hosted, e.g. Neon). No
  Docker required.
- A Firebase project with **Google** and **Email/Password** sign-in enabled.

## Setup

```bash
npm install

# Point the relay at your Postgres, then create the schema
cp .env.example apps/relay/.env      # set DATABASE_URL + the FIREBASE_* vars
npm run db:migrate                   # prisma migrate dev

npm run dev                          # relay :3001 + web :5173
```

### Auth (Firebase)

The browser authenticates **directly against Firebase** — the relay never sees a
password. Sign-in is Google or email/password, and the relay's `User` row is keyed
on the Firebase UID.

1. Create a Firebase project and enable **Authentication → Google** and
   **Email/Password**.
2. **Relay** (`apps/relay/.env`): paste the service-account credentials from
   *Project Settings → Service accounts → Generate new private key*:
   `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
   (single line, `\n`-escaped).
3. **Web** (`apps/web/.env.local`): paste the public web config from
   *Project Settings → General → Your apps → SDK setup and configuration*:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_APP_ID`.
4. Add `localhost` under *Authentication → Settings → Authorized domains* if it is
   not already there.

The relay connects to `DATABASE_URL` on boot (`PrismaService.onModuleInit`,
retried) and verifies it can read the agent index (`AgentsService.onModuleInit`);
if the database is unreachable or the schema is missing, startup fails with a
clear error instead of serving requests.

Sign in at http://localhost:5173, then in the **Agents** panel generate a pairing
code and run it through the agent:

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
npm run db:migrate  # prisma migrate dev (relay, local only)
npm run db:deploy   # prisma migrate deploy (relay)
npm run build:relay # generate prisma client + build protocol then relay
npm run start:relay # start the relay from the repo root
```

Run a single workspace: `npm run <script> -w @vima/relay` (or `@vima/web`,
`@vima/protocol`). Run one relay test:
`npm test -w @vima/relay -- jobs.service`.

## Deploying

The relay and the web app are deployed separately. This is an npm-workspaces
monorepo, so any platform must **run its commands from the repository root** (not
from `apps/relay`) and build `@vima/protocol` before the relay.

**Relay** (`apps/relay`, runs as `node dist/main`):

1. Set the environment (see `.env.example`): `DATABASE_URL`, `CORS_ORIGIN` (the
   exact web origin), the three `FIREBASE_*` admin vars, and `TRUST_PROXY=true`
   when behind a proxy/load balancer. Keep `NODE_ENV=production` for runtime.
2. Run migrations as a release step: `npm run db:deploy`.
3. Build and start:
   - Build: `npm ci --include=dev && npm run build:relay` — `build:relay`
     generates the Prisma client, then builds the protocol and the relay in
     order. `--include=dev` is required because `@nestjs/cli` and `prisma` are
     devDependencies; without it (or with `NODE_ENV=production` during install)
     the build fails with `nest: command not found` (exit `127`).
   - Start: `npm run start:relay`.
4. Terminate TLS at the proxy/load balancer — the agent connects over
   `https://` / `wss://`, so the public relay URL must be HTTPS.

> **Render / Railway-style services.** Leave the service **Root Directory** at
> the repository root (blank/default). Don't point it at `apps/relay`: the
> `nest` CLI and the `@vima/protocol` workspace live at the root, so a
> subdirectory build both fails to find `nest` (`127`) and never builds the
> protocol the relay imports. Use the build/start commands from step 3.

**Web** (`apps/web`, static `dist/`):

1. Set `VITE_API_URL` to the public relay URL plus the `VITE_FIREBASE_*` values
   (all are inlined at build time), then `npm run build -w @vima/web`.
2. Serve `dist/` with an SPA fallback (rewrite unknown paths to `index.html`) so
   the `/docs` route survives a refresh or deep link.
3. Add the deployed origin under Firebase
   *Authentication → Settings → Authorized domains*.

### Operational notes

- **Run exactly one relay instance.** Agent connections and the token index live
  in process memory and jobs dispatch only through the local process, so a second
  replica cannot reach an agent connected to the first. Scale only after adding a
  shared registry (e.g. Redis pub/sub).
- `GET /api/health` is a readiness probe: it returns `503` when the database is
  unreachable.
- Pairing (`POST /api/agent/pair`) is rate limited per client IP; the `/docs`
  page is public while the tester requires a Firebase session.

## Security model

Users authenticate with Firebase (Google or email/password); the relay verifies
the Firebase ID token and keys its own `User` row on the Firebase UID — it never
stores or sees a password. Every job is dispatched to the authenticated user's
*own* paired agent; the browser never talks to `localhost` and never sees the
agent token. See `AGENTS.md` for the full list of non-negotiable rules.
