/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { afkLocalAdapter } from './server/localAdapter.ts'
import { afkServiceWorker } from './server/serviceWorkerPlugin.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const ollamaHost = env.OLLAMA_HOST || 'http://127.0.0.1:11434'

  return {
    plugins: [react(), afkLocalAdapter(ollamaHost), afkServiceWorker()],
    // Localhost only by default. `npm run start:lan` opts in to LAN access for phone capture;
    // even then the Ollama route refuses every non-loopback client.
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true },
    build: {
      // The 3D workspace chunk is lazy-loaded and precached; it is allowed to be large.
      chunkSizeWarningLimit: 1100,
    },
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
    },
  }
})
