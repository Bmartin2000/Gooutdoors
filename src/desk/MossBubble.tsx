import { X } from 'lucide-react'
import { useGame } from '../app/GameContext.tsx'

export function MossFace() {
  return (
    <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden className="moss-face">
      <path d="M20 9 v-4" stroke="#5f8f4f" strokeWidth="1.6" />
      <path d="M20 6 c-5 0 -7 -3 -8 -6 c4 0 7 2 8 6 Z" fill="#7bb06a" />
      <path d="M20 6 c4 0 6 -2 7 -5 c-4 0 -6 2 -7 5 Z" fill="#5f9152" />
      <circle cx="20" cy="22" r="13" fill="#f1eee6" />
      <rect x="11" y="18" width="18" height="9" rx="4.5" fill="#141716" />
      <rect x="14.5" y="20.5" width="3" height="4" rx="1.5" className="moss-face__eye" />
      <rect x="22.5" y="20.5" width="3" height="4" rx="1.5" className="moss-face__eye" />
      <circle cx="11" cy="28" r="2" fill="#e5a5a0" />
      <circle cx="29" cy="28" r="2" fill="#e5a5a0" />
      <path d="M17 30 Q20 33 23 30" stroke="#5f8f4f" strokeWidth="1.4" fill="none" />
    </svg>
  )
}

/** Moss speaks: anchored above its head in the 3D office, or in the corner on the flat desktop. */
export default function MossBubble({ anchor }: { anchor: { x: number; y: number } | null }) {
  const { moss, dismissMoss, openApp } = useGame()
  if (!moss) return null
  const style = anchor ? { left: anchor.x, top: anchor.y } : undefined
  return (
    <div className={`moss-bubble moss-bubble--${moss.mood} ${anchor ? 'is-anchored' : 'is-docked'}`} style={style} role="status" aria-live="polite" key={moss.id}>
      {!anchor && <MossFace />}
      <div className="moss-bubble__body">
        <p className="moss-bubble__who">Moss</p>
        <p className="moss-bubble__text">{moss.text}</p>
        {moss.cta && (
          <button
            type="button"
            className="btn btn--sm btn--primary"
            onClick={() => {
              openApp(moss.cta!.app)
              dismissMoss()
            }}
          >
            {moss.cta.label}
          </button>
        )}
      </div>
      <button type="button" className="moss-bubble__x" onClick={dismissMoss} aria-label="Dismiss Moss">
        <X size={13} />
      </button>
    </div>
  )
}
