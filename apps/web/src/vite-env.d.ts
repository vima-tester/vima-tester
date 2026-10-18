/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the relay HTTP API. Defaults to http://localhost:3001. */
  readonly VITE_API_URL?: string;
  /** Firebase web config (public), from the Firebase console. */
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
