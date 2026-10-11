/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OLLAMA_MODEL?: string
  readonly VITE_PHONE_APP_URL?: string
  readonly VITE_ADMIN_USER?: string
  readonly VITE_ADMIN_SALT?: string
  readonly VITE_ADMIN_HASH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
