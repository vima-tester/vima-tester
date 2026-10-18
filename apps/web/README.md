# @vima/web

The browser UI for **vima-tester**: a Postman-style client for APIs running on *your own*
localhost. The browser never talks to `localhost` directly — it calls the relay, which pushes the
job down the WebSocket connection your local agent already holds open:

```
Browser (this app) --HTTP--> Relay (apps/relay) --WS--> vima-tunneler --> localhost:PORT
```

## Stack

- Vite 6 + React 18 + TypeScript 5.7
- TanStack Query v5 for server state (`GET /api/agents` polls every 5 s; `POST /api/run` is a mutation)
- Zod v3 for validation, reusing the schemas from `@vima/protocol`
- No CSS framework — a single dark-theme stylesheet (`src/styles.css`)

## Getting started

```bash
# from the repo root
npm install

# the protocol package must be built before this app typechecks/builds
npm run build -w @vima/protocol

npm run dev -w @vima/web      # http://localhost:5173
```

Scripts:

| Script | What it does |
|---|---|
| `npm run dev -w @vima/web` | Vite dev server on port 5173 |
| `npm run build -w @vima/web` | `tsc -b` then `vite build` into `dist/` |
| `npm run preview -w @vima/web` | Serve the production build |
| `npm run typecheck -w @vima/web` | `tsc --noEmit -p tsconfig.app.json` |

## Configuration

Copy `.env.example` to `.env.local` (git-ignored) and set the relay URL and the
public Firebase web config:

```
VITE_API_URL="http://localhost:3001"
VITE_FIREBASE_API_KEY="..."
VITE_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project"
VITE_FIREBASE_APP_ID="1:...:web:..."
```

All are read at build time; `VITE_API_URL` defaults to `http://localhost:3001`.

## What's on screen

1. **Auth gate** — Google or email/password sign-in via the Firebase JS SDK
   (`src/firebase.ts`). Firebase is the source of truth for the session; the app
   listens to `onAuthStateChanged` and calls `GET /api/auth/me` to resolve the
   relay-side user. No token is written to `localStorage`.
2. **Request builder** — method, URL, key/value headers, body (disabled for `GET`/`HEAD`), plus an
   optional per-request timeout and an explicit `insecureTLS` toggle. Hosts outside the agent's
   loopback allowlist are rejected before anything is sent.
3. **Response viewer** — status code color-coded by class, total time (`durationMs`), size, response
   headers, and the body: JSON is pretty-printed, text types are shown as text, anything else is
   offered as base64 plus a download. **Bodies are always rendered as escaped text — never as HTML.**
4. **Agents panel** — paired agents with a live connected indicator, revoke buttons, and
   "Generate pairing code" for `vima-tunneler`.

## Layout

```
src/
  api/client.ts        fetch wrapper: Firebase ID token, error parsing, Zod validation of responses
  api/hooks.ts         TanStack Query hooks (agents list, pairing code, revoke, run mutation)
  firebase.ts          Firebase app + Auth instance (Google and email/password)
  auth/AuthContext.tsx session state from onAuthStateChanged; resolves the user via GET /api/auth/me
  components/          AuthForm, RequestBuilder, ResponseViewer, AgentsPanel
  lib/responseBody.ts  base64 -> text/JSON/binary classification + download helper
  App.tsx, main.tsx, styles.css
```

Wire-protocol and REST shapes are **never** redefined here: everything comes from
`@vima/protocol`, which is the single source of truth shared with the relay.
