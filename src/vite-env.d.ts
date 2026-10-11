/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OLLAMA_MODEL?: string
  readonly VITE_PHONE_APP_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
