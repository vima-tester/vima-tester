/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the relay HTTP API. Defaults to http://localhost:3001. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
