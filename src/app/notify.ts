/** Local-only signals: desktop notifications, vibration, a soft chime. No push service. */

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && window.isSecureContext
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  return (await Notification.requestPermission()) === 'granted'
}

/** Shows a system notification while AFK.exe is open (even in a background tab). */
export async function showSystemNotification(title: string, body: string, tag: string) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  const options: NotificationOptions = { body, tag, icon: '/icon-192.png', badge: '/icon-192.png' }
  try {
    const reg = navigator.serviceWorker?.controller ? await navigator.serviceWorker.ready : null
    if (reg) await reg.showNotification(title, options)
    else new Notification(title, options)
  } catch {
    /* some mobile browsers only allow notifications from a service worker */
  }
}

/** Android vibrates; iOS Safari ignores it. Patterns are short on purpose. */
export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* unsupported */
  }
}

/** A short two-note chime synthesized locally (no audio files). */
export function playChime(kind: 'job' | 'reward' = 'reward') {
  try {
    const ctx = new AudioContext()
    const now = ctx.currentTime
    const notes = kind === 'job' ? [659.25, 880] : [523.25, 783.99]
    for (const [i, freq] of notes.entries()) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, now + i * 0.12)
      gain.gain.linearRampToValueAtTime(0.07, now + i * 0.12 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.8)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + i * 0.12)
      osc.stop(now + i * 0.12 + 0.9)
    }
    setTimeout(() => void ctx.close(), 1500)
  } catch {
    /* audio unavailable */
  }
}
