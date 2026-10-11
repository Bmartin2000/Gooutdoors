import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const ollamaHost = env.OLLAMA_HOST || 'http://127.0.0.1:11434'

  // A böngésző a saját origin-jén (/ollama) éri el a helyi Ollamát,
  // így nincs szükség CORS / OLLAMA_ORIGINS beállításra.
  const ollamaProxy = {
    '/ollama': {
      target: ollamaHost,
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/ollama/, ''),
    },
  }

  return {
    plugins: [react()],
    server: { proxy: ollamaProxy },
    preview: { proxy: ollamaProxy },
    // A three.js-t tartalmazó főoldal-chunk lazy-loadolt, ezért nagyobb lehet
    build: { chunkSizeWarningLimit: 1000 },
  }
})
