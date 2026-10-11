import { CheckCircle2, CircleAlert, CircleHelp, CloudOff, Download, Loader2, RotateCcw, Send, ShieldCheck, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAIStatus } from '../app/AIStatusContext.tsx'
import { useGame } from '../app/GameContext.tsx'
import { getContract, getMission, getVariant } from '../content/contracts.ts'
import { S } from '../content/strings.ts'
import { contractStatus } from '../game/rewardEngine.ts'
import type { MissionEvidence } from '../game/types.ts'

function useObjectUrl(blob: Blob) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

function phaseText(phase: string, warm: string, seconds: number) {
  if (phase === 'writing') return 'Writing its verdict…'
  // Ollama answers only once the image has been read, so "queued" and "reading" look the same here.
  return warm !== 'warm' && seconds > 25
    ? 'Your local AI is looking at the photo… (the first run also loads the model — on CPU this can take a few minutes)'
    : 'Your local AI is looking at the photo…'
}

export default function EvidenceCard({ item, prominent = false }: { item: MissionEvidence; prominent?: boolean }) {
  const { profile, progress, verify, cancelVerify, removeEvidence, exportEvidence, sendToDesk, isAIHost, field } = useGame()
  const { diagnostics, warm } = useAIStatus()
  const url = useObjectUrl(item.image)
  const mission = getMission(item.missionId)
  const variant = getVariant(item.missionId, item.variantId)
  const contract = getContract(item.contractId)
  const p = progress[item.id]
  const [now, setNow] = useState(() => Date.now())
  const status = contract ? contractStatus(profile, contract.id) : 'locked'

  useEffect(() => {
    if (item.status !== 'verifying') return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [item.status])

  const canVerifyHere = isAIHost && diagnostics.connection === 'ready'
  const seconds = p ? Math.round(p.elapsedMs / 1000) : 0
  void now

  let tone: 'ok' | 'warn' | 'muted' | 'busy' = 'muted'
  let icon = <CloudOff size={18} aria-hidden />
  let headline: string = S.explore.savedOffline
  if (item.status === 'saved-for-later' && canVerifyHere) {
    headline = status === 'mission' ? 'Photo saved. Ready for your local AI.' : status === 'completed' ? 'Saved. This contract is already complete.' : 'Saved. Finish this contract’s coding step to verify it.'
    icon = <ShieldCheck size={18} aria-hidden />
  } else if (item.status === 'verifying') {
    tone = 'busy'
    icon = <Loader2 size={18} className="spin" aria-hidden />
    headline = p ? phaseText(p.phase, warm, seconds) : 'Preparing…'
  } else if (item.status === 'verified') {
    tone = 'ok'
    icon = <CheckCircle2 size={18} aria-hidden />
    headline = 'Verified by your local AI'
  } else if (item.status === 'needs-review') {
    tone = 'warn'
    icon = <CircleHelp size={18} aria-hidden />
    headline = 'Not sure yet — the reward is on hold'
  } else if (item.status === 'rejected') {
    tone = 'warn'
    icon = <CircleAlert size={18} aria-hidden />
    headline = 'This photo doesn’t match the mission'
  } else if (item.status === 'verification-failed') {
    tone = 'warn'
    icon = <CircleAlert size={18} aria-hidden />
    headline = 'Unable to verify right now'
  }

  return (
    <article className={`evidence ${prominent ? 'evidence--prominent' : ''} evidence--${tone}`} aria-label={`${mission?.title} photo`}>
      <div className="evidence__media">
        {url ? <img src={url} alt={`Your photo for ${mission?.title}: ${variant?.title}`} /> : null}
        {item.status === 'verifying' && <div className="evidence__scan" aria-hidden />}
      </div>
      <div className="evidence__body">
        <p className="evidence__meta">
          {mission?.title} · {variant?.title} · {new Date(item.capturedAt).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })}
          {item.source === 'lan' && ' · from phone'}
          {item.source === 'import' && ' · imported'}
        </p>
        <p className={`evidence__status evidence__status--${tone}`} role="status">
          {icon}
          <span>{headline}</span>
        </p>
        {item.status === 'verifying' && (
          <p className="muted small">
            {seconds}s{p?.phase === 'writing' ? ` · ${p.tokens} tokens` : ''} · {diagnostics.model} on this computer
          </p>
        )}
        {item.result && item.status !== 'verifying' && (
          <div className="verdict">
            <p>{item.result.reason}</p>
            {item.result.detectedElements.length > 0 && (
              <ul className="tags" aria-label="Detected in the photo">
                {item.result.detectedElements.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
            <p className="muted small">
              Match estimate {Math.round(item.result.confidence * 100)}% · a model guess, not proof · {item.model}
            </p>
          </div>
        )}
        {item.lastError && item.status !== 'verifying' && <p className="error-text small">{item.lastError}</p>}
        {item.status === 'saved-for-later' && !canVerifyHere && (
          <p className="muted small">{isAIHost ? 'Start Ollama on this computer, then verify.' : S.ai.remoteDetail}</p>
        )}
        {item.sentAt && !isAIHost && <p className="muted small">Sent {new Date(item.sentAt).toLocaleTimeString('en', { timeStyle: 'short' })} — verify it on your computer.</p>}

        <div className="evidence__actions">
          {item.status === 'verifying' ? (
            <button type="button" className="btn btn--sm" onClick={() => cancelVerify(item.id)}>
              <X size={14} aria-hidden /> Cancel
            </button>
          ) : (
            <>
              {canVerifyHere && status === 'mission' && item.status !== 'verified' && (
                <button type="button" className={`btn ${prominent ? 'btn--primary btn--lg' : 'btn--sm btn--primary'}`} onClick={() => void verify(item.id)}>
                  {item.status === 'saved-for-later' ? (
                    <>
                      <ShieldCheck size={16} aria-hidden /> {S.explore.verifyNow}
                    </>
                  ) : (
                    <>
                      <RotateCcw size={15} aria-hidden /> Verify again
                    </>
                  )}
                </button>
              )}
              {!isAIHost && item.status !== 'verified' && field?.pairToken && (
                <button type="button" className="btn btn--sm btn--primary" onClick={() => void sendToDesk(item.id)}>
                  <Send size={14} aria-hidden /> Send to my computer
                </button>
              )}
              {item.status !== 'verified' && (
                <button type="button" className="btn btn--sm" onClick={() => void exportEvidence(item.id)}>
                  <Download size={14} aria-hidden /> Export file
                </button>
              )}
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => {
                  if (window.confirm('Delete this photo from this device?')) void removeEvidence(item.id)
                }}
                aria-label="Delete photo"
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  )
}
