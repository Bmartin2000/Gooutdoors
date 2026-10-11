import { CheckCircle2, CircleX, Lightbulb, Play, Undo2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useGame } from '../../app/GameContext.tsx'
import CodeBlock from '../../components/CodeBlock.tsx'
import { getChallenge, skillName } from '../../content/challenges.ts'
import { MAX_ATTEMPTS, type SubmitOutcome } from '../../game/economy.ts'
import type { CaseResult, Challenge, JobOffer } from '../../game/types.ts'

interface Finished {
  offer: JobOffer
  challenge: Challenge
  outcome: SubmitOutcome
  results: CaseResult[]
  feedback: string
}

function Cases({ results }: { results: CaseResult[] }) {
  return (
    <div className="cases-wrap">
      <table className="cases">
        <thead>
          <tr>
            <th scope="col">Check</th>
            <th scope="col">Expected</th>
            <th scope="col">Actual</th>
            <th scope="col">
              <span className="sr-only">Result</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.label} className={r.pass ? 'is-pass' : 'is-fail'}>
              <td>
                <code>{r.label}</code>
              </td>
              <td>
                <code>{r.expected}</code>
              </td>
              <td>
                <code>{r.actual}</code>
              </td>
              <td aria-label={r.pass ? 'pass' : 'fail'}>{r.pass ? '✓' : '✗'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function WorkApp() {
  const { profile, submit, hint, abandon, openApp } = useGame()
  const job = profile.activeJob
  const challenge = job ? getChallenge(job.offer.challengeId) : undefined
  const [selected, setSelected] = useState<string | null>(null)
  const [last, setLast] = useState<{ choiceId: string; results: CaseResult[]; feedback: string } | null>(null)
  const [finished, setFinished] = useState<Finished | null>(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    setSelected(null)
    setLast(null)
  }, [job?.offer.id])

  if (finished) {
    const done = finished.outcome.finished === 'done'
    return (
      <div className="work-result">
        <div className={`work-result__icon ${done ? 'is-ok' : 'is-no'}`}>{done ? <CheckCircle2 size={28} /> : <CircleX size={28} />}</div>
        <p className="eyebrow">{finished.offer.client}</p>
        <h2 className="work-result__title">{done ? `Paid $${finished.offer.pay}` : 'Contract cancelled'}</h2>
        {done ? (
          <p className="muted">
            +{finished.offer.xp} XP · {finished.challenge.trains.map((s) => `${skillName(s)} +${finished.challenge.difficulty}`).join(' · ')}
          </p>
        ) : (
          <p className="muted">Two wrong submissions. No pay this time — the lesson is still yours.</p>
        )}
        <Cases results={finished.results} />
        <p className="lesson">
          <Lightbulb size={15} aria-hidden />
          <span>{finished.challenge.lesson}</span>
        </p>
        <button type="button" className="btn btn--primary" onClick={() => { setFinished(null); openApp('inbox') }}>
          Back to inbox
        </button>
      </div>
    )
  }

  if (!job || !challenge) {
    return (
      <div className="empty empty--center">
        <p>No active job.</p>
        <p className="muted small">Accept an offer in your inbox to start working.</p>
        <button type="button" className="btn btn--sm btn--primary" onClick={() => openApp('inbox')}>
          Open inbox
        </button>
      </div>
    )
  }

  const attemptsLeft = MAX_ATTEMPTS - job.attempts
  const choice = challenge.choices.find((c) => c.id === selected)

  const run = async () => {
    if (!choice) return
    setRunning(true)
    const results = await choice.evaluate()
    const outcome = await submit(choice.id)
    setRunning(false)
    if (!outcome) return
    if (outcome.finished) setFinished({ offer: job.offer, challenge, outcome, results, feedback: choice.feedback })
    else {
      setLast({ choiceId: choice.id, results, feedback: choice.feedback })
      setSelected(null)
    }
  }

  return (
    <div className="work">
      <header className="work__head">
        <div>
          <p className="eyebrow">
            {job.offer.client} · ${job.offer.pay} · +{job.offer.xp} XP
          </p>
          <h2>{job.offer.title}</h2>
          <p className="muted small">{challenge.brief}</p>
        </div>
        <div className="work__tries" aria-label={`${attemptsLeft} submissions left`}>
          {Array.from({ length: MAX_ATTEMPTS }, (_, i) => (
            <i key={i} className={i < attemptsLeft ? 'is-on' : ''} />
          ))}
          <span className="muted small">{attemptsLeft} left</span>
        </div>
      </header>

      <div className="work__grid">
        <div className="stack-3">
          <CodeBlock code={challenge.code} focusLines={challenge.focusLines} fileName={challenge.fileName} />
          {last && (
            <section className="feedback feedback--no" aria-live="polite">
              <header className="feedback__head">
                <CircleX size={18} aria-hidden />
                <h3>Not quite — {attemptsLeft} submission left</h3>
              </header>
              <Cases results={last.results} />
              <p className="feedback__text">{last.feedback}</p>
            </section>
          )}
        </div>

        <fieldset className="choices">
          <legend className="h3">{challenge.question}</legend>
          {challenge.choices.map((c) => {
            const gone = job.eliminated.includes(c.id) || last?.choiceId === c.id
            return (
              <label key={c.id} className={`choice ${selected === c.id ? 'is-selected' : ''} ${gone ? 'is-gone' : ''}`}>
                <input type="radio" name="choice" value={c.id} checked={selected === c.id} disabled={gone} onChange={() => setSelected(c.id)} />
                <span className="choice__key" aria-hidden>
                  {c.id.toUpperCase()}
                </span>
                <span className="choice__body">
                  <span className="choice__label">{c.label}</span>
                  <CodeBlock code={c.code} compact label={`Option ${c.id.toUpperCase()}`} />
                </span>
              </label>
            )
          })}
          <button type="button" className="btn btn--primary btn--block" disabled={!choice || running} onClick={() => void run()}>
            <Play size={15} aria-hidden /> Run tests & submit
          </button>
          <div className="row-between">
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              disabled={profile.tokens < 1 || job.eliminated.length >= challenge.choices.length - 2}
              onClick={() => void hint()}
              title="Spend one fresh-air token to remove a wrong option"
            >
              <Lightbulb size={14} aria-hidden /> Hint · 1 🌿
            </button>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => {
                if (window.confirm('Hand this job back? The energy you spent is not refunded.')) void abandon()
              }}
            >
              <Undo2 size={14} aria-hidden /> Hand back
            </button>
          </div>
        </fieldset>
      </div>
    </div>
  )
}
