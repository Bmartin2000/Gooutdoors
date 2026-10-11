/**
 * Emits /sw.js at build time with an explicit precache list of every bundled asset
 * (app shell, fonts, mission content, 3D scene chunk). No third-party PWA runtime needed.
 */
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'

const PUBLIC_FILES = ['', 'index.html', 'manifest.webmanifest', 'favicon.svg', 'icon-192.png', 'icon-512.png']

export function afkServiceWorker(): Plugin {
  let config: ResolvedConfig
  return {
    name: 'afk-service-worker',
    apply: 'build',
    configResolved(c) {
      config = c
    },
    // Static hosts (GitHub Pages) serve 404.html for unknown paths: make it the app shell.
    closeBundle() {
      const out = join(config.root, config.build.outDir)
      if (existsSync(join(out, 'index.html'))) copyFileSync(join(out, 'index.html'), join(out, '404.html'))
    },
    generateBundle(_options, bundle) {
      const base = config.base.endsWith('/') ? config.base : `${config.base}/`
      const assets = Object.keys(bundle).filter((file) => !file.endsWith('.map') && file !== 'index.html')
      const precache = [...PUBLIC_FILES, ...assets].map((file) => `${base}${file}`)
      
      const source = `/* AFK.exe service worker — generated at build time. */
const CACHE = 'afk-exe-__VERSION__';
const PRECACHE = ${JSON.stringify(precache)};
const BASE = ${JSON.stringify(config.base.endsWith('/') ? config.base : config.base + '/')};
const NEVER_CACHE = ['/ollama/', '/afk-local/', '/afk-sync/'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('afk-exe-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_CACHE.some((prefix) => url.pathname.startsWith(prefix))) return;

  // App routes: network first so updates land, cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(BASE + 'index.html', { ignoreVary: true })));
    return;
  }
  // Hashed assets: cache first.
  event.respondWith(caches.match(request, { ignoreVary: true, ignoreSearch: true }).then((hit) => hit || fetch(request)));
});
`
      // The cache version covers both the asset list and the worker logic itself.
      const version = createHash('sha256').update(source).digest('hex').slice(0, 12)
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: source.replace('__VERSION__', version) })
    },
  }
}
