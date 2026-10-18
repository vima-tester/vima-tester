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
npm run db:migrate  # prisma migrate dev (relay)
```

Run a single workspace: `npm run <script> -w @vima/relay` (or `@vima/web`,
`@vima/protocol`). Run one relay test:
`npm test -w @vima/relay -- jobs.service`.

## Security model

Users authenticate with Firebase (Google or email/password); the relay verifies
the Firebase ID token and keys its own `User` row on the Firebase UID — it never
stores or sees a password. Every job is dispatched to the authenticated user's
*own* paired agent; the browser never talks to `localhost` and never sees the
agent token. See `AGENTS.md` for the full list of non-negotiable rules.
