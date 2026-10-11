/**
 * AFK.exe local adapter — a tiny, tightly scoped Node middleware mounted into the
 * Vite dev and preview servers.
 *
 *  /ollama/*         → allow-listed proxy to the local Ollama HTTP API.
 *                      Loopback clients only: a phone on the LAN can never reach the model.
 *  /afk-local/*      → pairing info for the desktop (loopback only).
 *  /afk-sync/*       → optional same-LAN photo inbox: a phone that loaded the app from
 *                      this computer can hand a captured photo to the desktop, guarded by
 *                      a per-process pairing token. Held in memory only, never written to disk.
 *
 * No CORS headers are ever emitted: everything is same-origin by design.
 */
import { randomBytes, timingSafeEqual } from 'node:crypto'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import type { Connect, Plugin, PreviewServer, ViteDevServer } from 'vite'

const OLLAMA_ROUTES = new Set(['GET /api/version', 'GET /api/tags', 'POST /api/show', 'POST /api/chat'])
const MAX_OLLAMA_BODY = 16 * 1024 * 1024 // base64 photos are downscaled client-side, this is a hard ceiling
const MAX_SYNC_BODY = 12 * 1024 * 1024
const MAX_INBOX_ITEMS = 24

interface InboxItem {
  id: string
  receivedAt: string
  bundle: unknown
}

function isLoopback(req: http.IncomingMessage): boolean {
  const addr = req.socket.remoteAddress ?? ''
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
}

/** Browsers send Origin on POST; if present it must match the Host we were addressed by. */
function isSameOrigin(req: http.IncomingMessage): boolean {
  const origin = req.headers.origin
  if (!origin) return true
  try {
    return new URL(origin).host === req.headers.host
  } catch {
    return false
  }
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function readBody(req: http.IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('payload-too-large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function lanAddresses(): string[] {
  const result: string[] = []
  for (const list of Object.values(os.networkInterfaces())) {
    for (const info of list ?? []) {
      if (info.family === 'IPv4' && !info.internal) result.push(info.address)
    }
  }
  return result
}

function tokenMatches(given: string | null, expected: string): boolean {
  if (!given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

function createMiddleware(ollamaHost: string, getPort: () => number | undefined, lanEnabled: () => boolean, isHttps: () => boolean) {
  const token = randomBytes(12).toString('base64url')
  const inbox: InboxItem[] = []
  const target = new URL(ollamaHost)

  const proxyOllama = async (req: http.IncomingMessage, res: http.ServerResponse, path: string) => {
    if (!isLoopback(req)) {
      return sendJson(res, 403, {
        error: 'afk-remote-client',
        message: 'The local AI only answers on the computer that runs it.',
      })
    }
    if (!isSameOrigin(req)) return sendJson(res, 403, { error: 'origin-not-allowed' })
    if (!OLLAMA_ROUTES.has(`${req.method} ${path}`)) return sendJson(res, 404, { error: 'route-not-allowed' })

    let body: Buffer | undefined
    if (req.method === 'POST') {
      try {
        body = await readBody(req, MAX_OLLAMA_BODY)
      } catch {
        return sendJson(res, 413, { error: 'payload-too-large' })
      }
    }

    const upstream = http.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 11434,
        path,
        method: req.method,
        headers: body ? { 'Content-Type': 'application/json', 'Content-Length': body.length } : {},
      },
      (up) => {
        res.statusCode = up.statusCode ?? 502
        res.setHeader('Content-Type', up.headers['content-type'] ?? 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        up.pipe(res)
      },
    )
    upstream.on('error', () => {
      if (!res.headersSent) sendJson(res, 502, { error: 'ollama-unreachable' })
      else res.end()
    })
    // Cancel inference when the browser aborts the request.
    res.on('close', () => {
      if (!res.writableFinished) upstream.destroy()
    })
    upstream.end(body)
  }

  const handleSync = async (req: http.IncomingMessage, res: http.ServerResponse, url: URL) => {
    const route = `${req.method} ${url.pathname}`

    if (route === 'GET /afk-local/pairing') {
      if (!isLoopback(req)) return sendJson(res, 403, { error: 'loopback-only' })
      const port = getPort()
      const scheme = isHttps() ? 'https' : 'http'
      const urls = lanEnabled() && port ? lanAddresses().map((ip) => `${scheme}://${ip}:${port}`) : []
      return sendJson(res, 200, { token, lanEnabled: lanEnabled(), urls })
    }

    if (route === 'POST /afk-sync/evidence') {
      if (!isSameOrigin(req)) return sendJson(res, 403, { error: 'origin-not-allowed' })
      if (!tokenMatches(url.searchParams.get('token'), token)) return sendJson(res, 401, { error: 'bad-token' })
      if (!String(req.headers['content-type']).startsWith('application/json')) {
        return sendJson(res, 415, { error: 'json-only' })
      }
      let raw: Buffer
      try {
        raw = await readBody(req, MAX_SYNC_BODY)
      } catch {
        return sendJson(res, 413, { error: 'payload-too-large' })
      }
      let bundle: unknown
      try {
        bundle = JSON.parse(raw.toString('utf8'))
      } catch {
        return sendJson(res, 400, { error: 'invalid-json' })
      }
      // Full schema validation happens in the desktop app before anything is stored.
      if (typeof bundle !== 'object' || bundle === null || (bundle as { format?: unknown }).format !== 'afk.exe/outing') {
        return sendJson(res, 400, { error: 'not-an-afk-bundle' })
      }
      inbox.push({ id: randomBytes(8).toString('hex'), receivedAt: new Date().toISOString(), bundle })
      while (inbox.length > MAX_INBOX_ITEMS) inbox.shift()
      return sendJson(res, 200, { ok: true })
    }

    if (route === 'GET /afk-sync/inbox') {
      if (!isLoopback(req)) return sendJson(res, 403, { error: 'loopback-only' })
      return sendJson(res, 200, { items: inbox })
    }

    if (route === 'POST /afk-sync/inbox/ack') {
      if (!isLoopback(req) || !isSameOrigin(req)) return sendJson(res, 403, { error: 'loopback-only' })
      try {
        const { ids } = JSON.parse((await readBody(req, 64 * 1024)).toString('utf8')) as { ids?: unknown }
        if (Array.isArray(ids)) {
          for (const id of ids) {
            const i = inbox.findIndex((item) => item.id === id)
            if (i >= 0) inbox.splice(i, 1)
          }
        }
        return sendJson(res, 200, { ok: true })
      } catch {
        return sendJson(res, 400, { error: 'invalid-json' })
      }
    }

    return sendJson(res, 404, { error: 'not-found' })
  }

  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname.startsWith('/ollama/')) {
      void proxyOllama(req, res, url.pathname.slice('/ollama'.length))
      return
    }
    if (url.pathname.startsWith('/afk-local/') || url.pathname.startsWith('/afk-sync/')) {
      void handleSync(req, res, url)
      return
    }
    next()
  }
  return middleware
}

function boundPort(server: ViteDevServer | PreviewServer): number | undefined {
  const address = server.httpServer?.address() as AddressInfo | string | null | undefined
  return typeof address === 'object' && address ? address.port : undefined
}

function isLanHost(host: string | boolean | undefined): boolean {
  return host === true || (typeof host === 'string' && host !== 'localhost' && host !== '127.0.0.1')
}

export function afkLocalAdapter(ollamaHost: string): Plugin {
  return {
    name: 'afk-local-adapter',
    configureServer(server) {
      server.middlewares.use(
        createMiddleware(ollamaHost, () => boundPort(server), () => isLanHost(server.config.server.host), () => !!server.config.server.https),
      )
    },
    configurePreviewServer(server) {
      server.middlewares.use(
        createMiddleware(ollamaHost, () => boundPort(server), () => isLanHost(server.config.preview.host), () => !!server.config.preview.https),
      )
    },
  }
}
