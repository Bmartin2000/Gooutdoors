import { ArrowRight, Sparkles } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '../app/GameContext.tsx'
import { getContract } from '../content/contracts.ts'
import { getTool, LEVELS } from '../game/levels.ts'

/** A short, original SVG growth animation (≈1.2 s). Static under reduced motion. */
export function PlantGrowthTransition({ stage }: { stage: number }) {
  return (
    <svg className="growth" viewBox="0 0 160 160" aria-hidden>
      <circle cx="80" cy="80" r="70" className="growth__halo" />
      <path d="M80 132 C 80 110 80 92 80 70" className="growth__stem" />
      <path d="M80 98 C 62 96 50 84 46 66 C 64 66 77 78 80 98 Z" className="growth__leaf growth__leaf--1" />
      <path d="M80 86 C 98 84 110 72 114 54 C 96 54 83 66 80 86 Z" className="growth__leaf growth__leaf--2" />
      {stage >= 2 && <path d="M80 72 C 70 64 66 52 70 40 C 80 48 83 60 80 72 Z" className="growth__leaf growth__leaf--3" />}
      {stage >= 3 && <path d="M80 112 C 100 114 112 106 120 92 C 102 88 88 96 80 112 Z" className="growth__leaf growth__leaf--4" />}
      <ellipse cx="80" cy="134" rx="26" ry="5" className="growth__soil" />
    </svg>
  )
}

export default function RewardReveal({ reducedMotion }: { reducedMotion: boolean }) {
  const { reveal, dismissReveal } = useGame()
  const navigate = useNavigate()
  const primary = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!reveal) return
    primary.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismissReveal()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reveal, dismissReveal])

  if (!reveal) return null
  const contract = getContract(reveal.contractId)
  const tool = getTool(reveal.toolsUnlocked[0])
  const level = LEVELS.find((l) => l.level === reveal.levelTo)!

  const go = (to: string) => {
    dismissReveal()
    navigate(to)
  }

  return (
    <div className={`overlay overlay--reveal ${reducedMotion ? '' : 'is-animated'}`} role="dialog" aria-modal="true" aria-labelledby="reveal-title">
      <div className="reveal">
        <PlantGrowthTransition stage={reveal.roomStageTo} />
        <p className="eyebrow eyebrow--accent">Verified by your local AI · {contract?.title}</p>
        <h2 id="reveal-title" className="reveal__title">
          {tool.name} unlocked
        </h2>
        <p className="reveal__sub">{tool.tagline}</p>
        <dl className="reveal__stats">
          <div>
            <dt>XP</dt>
            <dd>+{reveal.xpAmount}</dd>
          </div>
          <div>
            <dt>Level</dt>
            <dd>
              {reveal.levelTo} · {level.name}
            </dd>
          </div>
          <div>
            <dt>Workspace</dt>
            <dd>{level.description}</dd>
          </div>
        </dl>
        <div className="reveal__actions">
          <button ref={primary} type="button" className="btn btn--primary btn--lg" onClick={() => go(`/companion?tool=${tool.id}`)}>
            <Sparkles size={17} aria-hidden /> Open {tool.name}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => go('/')}>
            See your workspace <ArrowRight size={16} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}
