/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEMO_ADMIN_EMAIL?: string;
  readonly VITE_DEMO_PASSWORD?: string;
  readonly VITE_DEMO_TENANT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
