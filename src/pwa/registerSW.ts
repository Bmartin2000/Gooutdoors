/**
 * Registers the build-time generated service worker (production builds only).
 * Service workers need a secure context: localhost or HTTPS. Over plain-HTTP LAN
 * addresses the app still works while open and stores photos in IndexedDB, but cannot
 * be reloaded without the network — see README › Offline reality.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !window.isSecureContext) return
  let controlled = !!navigator.serviceWorker.controller
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controlled && !reloading) {
      reloading = true
      window.location.reload()
    }
    controlled = true
  })
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL, updateViaCache: 'none' }).then((registration) => {
      const update = () => { if (navigator.onLine) void registration.update().catch(() => undefined) }
      update()
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') update() })
    }).catch((error: unknown) => {
      console.warn('AFK.exe: offline cache unavailable', error)
    })
  })
}
