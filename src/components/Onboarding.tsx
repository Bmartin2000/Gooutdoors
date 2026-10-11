import { ArrowRight, ShieldCheck } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '../app/GameContext.tsx'
import { CONTRACTS } from '../content/contracts.ts'
import { S } from '../content/strings.ts'
import { BrandMark } from './Brand.tsx'

export default function Onboarding() {
  const { completeOnboarding, startContract } = useGame()
  const navigate = useNavigate()
  const beginRef = useRef<HTMLButtonElement>(null)
  const first = CONTRACTS[0]

  useEffect(() => beginRef.current?.focus(), [])

  const begin = async () => {
    await completeOnboarding()
    await startContract(first.id)
    navigate(`/contracts/${first.id}`)
  }

  return (
    <div className="overlay overlay--onboarding" role="dialog" aria-modal="true" aria-labelledby="onb-title">
      <div className="onboarding">
        <div className="onboarding__mark">
          <BrandMark size={40} />
          <span className="eyebrow">{S.onboarding.eyebrow}</span>
        </div>
        <h1 id="onb-title" className="display">
          {S.onboarding.title}
        </h1>
        <p className="lead">{S.onboarding.body}</p>
        <ol className="onboarding__steps">
          {S.onboarding.steps.map((step, i) => (
            <li key={step}>
              <span className="onboarding__num">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <div className="onboarding__contract">
          <span className="eyebrow">First contract</span>
          <strong>{first.title}</strong>
          <span className="muted">
            {first.client} · {first.estimate}
          </span>
        </div>
        <div className="onboarding__actions">
          <button ref={beginRef} type="button" className="btn btn--primary btn--lg" onClick={() => void begin()}>
            {S.onboarding.begin}
            <ArrowRight size={18} aria-hidden />
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => void completeOnboarding()}>
            Look around first
          </button>
        </div>
        <p className="onboarding__privacy">
          <ShieldCheck size={15} aria-hidden /> {S.onboarding.privacy}
        </p>
      </div>
    </div>
  )
}
