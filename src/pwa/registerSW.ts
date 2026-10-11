/**
 * Registers the build-time generated service worker (production builds only).
 * Service workers need a secure context: localhost or HTTPS. Over plain-HTTP LAN
 * addresses the app still works while open and stores photos in IndexedDB, but cannot
 * be reloaded without the network — see README › Offline reality.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !window.isSecureContext) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.warn('AFK.exe: offline cache unavailable', error)
    })
  })
}
