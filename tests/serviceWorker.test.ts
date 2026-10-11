import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { afkServiceWorker } from '../server/serviceWorkerPlugin.ts'

function worker() {
  let source = ''
  const plugin = afkServiceWorker() as unknown as {
    configResolved: (config: { base: string }) => void
    generateBundle: (this: { emitFile: (asset: { source: string }) => void }, options: object, bundle: object) => void
  }
  plugin.configResolved({ base: '/Gooutdoors/' })
  plugin.generateBundle.call({ emitFile: (asset) => { source = asset.source } }, {}, { 'assets/app.js': {} })
  type FetchEvent = { request: { method: string; mode: string; url: string }; respondWith: (response: Promise<Response>) => void }
  const listeners: Record<string, (event: FetchEvent) => void> = {}
  const cached = new Map<string, Response>()
  const cache = { put: vi.fn(async (key: string, response: Response) => { cached.set(key, response) }), match: vi.fn(async (key: string) => cached.get(key)) }
  const network = vi.fn(async () => new Response('fresh game', { status: 200 }))
  runInNewContext(source, {
    self: { location: { origin: 'https://example.test' }, addEventListener: (name: string, handler: (event: FetchEvent) => void) => { listeners[name] = handler } },
    fetch: network, caches: { open: async () => cache }, URL, Date, Response,
  })
  const navigate = (path: string) => {
    let response: Promise<Response> | undefined
    listeners.fetch({ request: { method: 'GET', mode: 'navigate', url: `https://example.test${path}` }, respondWith: (value) => { response = value } })
    return response!
  }
  return { cached, cache, network, navigate }
}

describe('phone update and offline shell', () => {
  it('loads the fresh shell for deep routes and retains it for offline navigation', async () => {
    const w = worker()
    const fresh = await w.navigate('/Gooutdoors/outside')
    expect(await fresh.text()).toBe('fresh game')
    expect(w.network).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/example.test\/Gooutdoors\/index.html\?afk-update=\d+$/), { cache: 'no-store' })
    expect(w.cached.has('/Gooutdoors/index.html')).toBe(true)
    w.network.mockRejectedValueOnce(new Error('offline'))
    expect(await (await w.navigate('/Gooutdoors/')).text()).toBe('fresh game')
  })

  it('falls back to the saved shell when the host returns an HTTP error', async () => {
    const w = worker()
    w.cached.set('/Gooutdoors/index.html', new Response('saved game'))
    w.network.mockResolvedValueOnce(new Response('missing', { status: 404 }))
    expect(await (await w.navigate('/Gooutdoors/outside')).text()).toBe('saved game')
    expect(w.cache.put).not.toHaveBeenCalled()
  })
})
