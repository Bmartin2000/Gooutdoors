import { ArrowRight, ChevronDown, Info, Leaf, ShieldAlert } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAIStatus } from '../app/AIStatusContext.tsx'
import { useGame } from '../app/GameContext.tsx'
import { useOnline } from '../app/usePreferences.ts'
import EvidenceCard from '../components/EvidenceCard.tsx'
import PhonePairing from '../components/PhonePairing.tsx'
import PhotoCapture from '../components/PhotoCapture.tsx'
import { CONTRACTS, getContract, getMission, getVariant } from '../content/contracts.ts'
import { S } from '../content/strings.ts'
import { contractStatus, currentContract } from '../game/rewardEngine.ts'

interface Target {
  contractId: string
  missionId: string
  variantId: string
  from: 'profile' | 'field'
}

function HowOfflineWorks() {
  return (
    <details className="disclosure">
      <summary>
        <Info size={16} aria-hidden /> How offline works <ChevronDown size={16} className="disclosure__chev" aria-hidden />
      </summary>
      <ol className="disclosure__body">
        <li>Once loaded, this page keeps working with no signal. Your photo is stored on this device.</li>
        <li>The AI check runs only on the computer with Ollama — never in the cloud, never on this phone.</li>
        <li>Back on your Wi-Fi, tap “Send to my computer”, or export the photo as a file (AirDrop, USB, Nearby Share).</li>
        <li>Verify it on the computer. Your reward appears there.</li>
      </ol>
    </details>
  )
}

export default function ExplorePage() {
  const { profile, evidence, field, setField, chooseVariant, addPhoto, verify, isAIHost } = useGame()
  const { diagnostics, warmUp } = useAIStatus()
  const online = useOnline()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  // Pick up a mission handed over by QR code: /explore?field=<contract>&variant=<v>&pair=<token>
  useEffect(() => {
    const contractId = params.get('field')
    if (!contractId) return
    const contract = getContract(contractId)
    if (contract) {
      const variant = getVariant(contract.missionId, params.get('variant') ?? undefined)
      void setField({
        contractId,
        missionId: contract.missionId,
        variantId: variant?.id ?? '',
        pairToken: params.get('pair') ?? undefined,
        receivedAt: new Date().toISOString(),
      })
    }
    setParams({}, { replace: true })
  }, [params, setField, setParams])

  const target: Target | null = useMemo(() => {
    const active = CONTRACTS.find((c) => contractStatus(profile, c.id) === 'mission')
    if (active) {
      const variantId = profile.contracts[active.id]?.variantId ?? getMission(active.missionId)!.variants[0].id
      return { contractId: active.id, missionId: active.missionId, variantId, from: 'profile' }
    }
    if (field && !isAIHost) return { ...field, from: 'field' }
    return null
  }, [profile, field, isAIHost])

  useEffect(() => {
    if (target && isAIHost && diagnostics.connection === 'ready') warmUp()
  }, [target, isAIHost, diagnostics.connection, warmUp])

  const mission = target ? getMission(target.missionId) : undefined
  const variant = target ? getVariant(target.missionId, target.variantId) : undefined
  const forTarget = evidence.filter((e) => target && e.contractId === target.contractId)
  const latest = forTarget[0]
  const others = evidence.filter((e) => e !== latest)

  const onFile = async (file: File, source: 'camera' | 'upload') => {
    if (!target || !variant) return
    const record = await addPhoto(file, source, { contractId: target.contractId, missionId: target.missionId, variantId: variant.id })
    // On the AI host with the model ready, verify straight away; elsewhere the photo waits safely.
    if (record && isAIHost && diagnostics.connection === 'ready' && target.from === 'profile') void verify(record.id)
  }

  const selectVariant = (variantId: string) => {
    if (!target) return
    if (target.from === 'profile') void chooseVariant(target.contractId, variantId)
    else if (field) void setField({ ...field, variantId })
  }

  if (!target || !mission || !variant) {
    const next = currentContract(profile)
    return (
      <div className="page page--explore">
        <section className="field-card stack-4">
          <span className="field-card__icon">
            <Leaf size={22} aria-hidden />
          </span>
          <p className="eyebrow">{S.explore.eyebrow}</p>
          <h1 className="h1">{next ? 'Your next mission starts at your desk.' : 'Every mission is complete.'}</h1>
          <p className="lead">
            {next
              ? `Solve “${next.title}” first — a short coding contract unlocks its outdoor mission.`
              : 'Your studio is fully grown. The outdoors is still there whenever you need a reset.'}
          </p>
          {next && isAIHost && (
            <button type="button" className="btn btn--primary btn--lg" onClick={() => navigate(`/contracts/${next.id}`)}>
              Open contract <ArrowRight size={17} aria-hidden />
            </button>
          )}
          {!isAIHost && (
            <p className="note">On a phone? Scan the mission QR code on your computer’s Explore page to bring a mission here.</p>
          )}
          {!isAIHost && <HowOfflineWorks />}
        </section>
        {others.length > 0 && (
          <section className="stack-3" aria-labelledby="queue-title">
            <h2 id="queue-title" className="section-title">
              {S.explore.queue}
            </h2>
            {others.map((e) => (
              <EvidenceCard key={e.id} item={e} />
            ))}
          </section>
        )}
      </div>
    )
  }

  const verifiedHere = latest?.status === 'verified'

  return (
    <div className="page page--explore">
      <div className="explore-grid">
        <div className="stack-4">
          <section className="field-card" aria-labelledby="mission-title">
            <p className="eyebrow eyebrow--accent">{S.explore.eyebrow}</p>
            <h1 id="mission-title" className="field-card__title">
              {mission.title}
            </h1>
            <p className="field-card__instruction">{variant.instruction}</p>

            <fieldset className="variant-switch">
              <legend className="sr-only">{S.explore.alternative}</legend>
              {mission.variants.map((v) => (
                <label key={v.id} className={`variant ${v.id === variant.id ? 'is-on' : ''}`}>
                  <input type="radio" name="variant" checked={v.id === variant.id} onChange={() => selectVariant(v.id)} />
                  {v.title}
                </label>
              ))}
            </fieldset>

            {!verifiedHere && <PhotoCapture onFile={(f, s) => void onFile(f, s)} disabled={latest?.status === 'verifying'} />}
            <p className="field-card__pocket">{S.explore.pocket}</p>

            <details className="disclosure">
              <summary>
                <ShieldAlert size={16} aria-hidden /> {S.explore.safety} <ChevronDown size={16} className="disclosure__chev" aria-hidden />
              </summary>
              <ul className="disclosure__body">
                {mission.safety.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </details>
            {(!isAIHost || !online) && <HowOfflineWorks />}
          </section>

          {latest && <EvidenceCard item={latest} prominent />}
          {latest && (latest.status === 'needs-review' || latest.status === 'rejected') && (
            <p className="muted small center">Fair retries are unlimited. A clearer, closer photo of the subject usually helps.</p>
          )}
        </div>

        <div className="stack-4">
          {target.from === 'profile' && <PhonePairing target={target} />}
          <section className="stack-3" aria-labelledby="queue-title">
            <h2 id="queue-title" className="section-title">
              {S.explore.queue}
            </h2>
            {others.length === 0 ? <p className="muted small">{S.explore.queueEmpty}</p> : others.map((e) => <EvidenceCard key={e.id} item={e} />)}
          </section>
        </div>
      </div>
    </div>
  )
}
