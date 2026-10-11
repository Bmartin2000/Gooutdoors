import { ArrowLeft, ArrowRight, CheckCircle2, CircleX, FlaskConical, Lightbulb, Play, TreePine } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useGame } from '../app/GameContext.tsx'
import CodeBlock from '../components/CodeBlock.tsx'
import { getContract, getMission } from '../content/contracts.ts'
import { contractStatus } from '../game/rewardEngine.ts'
import type { CaseResult, ChallengeChoice, Contract } from '../game/types.ts'

function ChallengeFeedback({ choice, results, correct, contract }: { choice: ChallengeChoice; results: CaseResult[]; correct: boolean; contract: Contract }) {
  return (
    <section className={`feedback ${correct ? 'feedback--ok' : 'feedback--no'}`} aria-live="polite" aria-labelledby="feedback-title">
      <header className="feedback__head">
        {correct ? <CheckCircle2 size={20} aria-hidden /> : <CircleX size={20} aria-hidden />}
        <h3 id="feedback-title">{correct ? 'Fix accepted' : 'Not quite — try another option'}</h3>
      </header>
      <div className="cases-wrap">
      <table className="cases">
        <caption className="sr-only">Test results for option {choice.id.toUpperCase()}</caption>
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
      <p className="feedback__text">{choice.feedback}</p>
      {correct && (
        <p className="lesson">
          <Lightbulb size={16} aria-hidden />
          <span>{contract.challenge.lesson}</span>
        </p>
      )}
    </section>
  )
}

export default function ContractPage() {
  const { id = '' } = useParams()
  const contract = getContract(id)
  const { profile, startContract, submitChallenge } = useGame()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string | null>(null)
  const [ran, setRan] = useState<{ choiceId: string; results: CaseResult[]; correct: boolean } | null>(null)
  const missionCard = useRef<HTMLDivElement>(null)
  const status = contract ? contractStatus(profile, contract.id) : 'locked'

  useEffect(() => {
    if (contract && status === 'available') void startContract(contract.id)
  }, [contract, status, startContract])

  useEffect(() => {
    if (ran?.correct) missionCard.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [ran])

  if (!contract) {
    return (
      <div className="page page--narrow">
        <p>That contract does not exist.</p>
        <Link to="/">Back to workspace</Link>
      </div>
    )
  }

  if (status === 'locked') {
    return (
      <div className="page page--narrow stack-4">
        <Link to="/" className="back">
          <ArrowLeft size={16} aria-hidden /> Workspace
        </Link>
        <div className="card card--pad stack-3">
          <p className="eyebrow">Locked</p>
          <h1 className="h2">{contract.title}</h1>
          <p className="muted">Finish the previous contract and its outdoor mission to unlock this one.</p>
        </div>
      </div>
    )
  }

  const { challenge } = contract
  const solved = status === 'mission' || status === 'completed'
  const mission = getMission(contract.missionId)!
  const choice = challenge.choices.find((c) => c.id === (selected ?? ''))

  const run = async () => {
    if (!choice) return
    const results = choice.evaluate()
    const correct = await submitChallenge(contract.id, choice.id)
    setRan({ choiceId: choice.id, results, correct })
  }

  return (
    <div className="page page--contract">
      <Link to="/" className="back">
        <ArrowLeft size={16} aria-hidden /> Workspace
      </Link>

      <header className="contract-head">
        <p className="eyebrow">
          {contract.client} · {contract.difficulty} · {contract.estimate}
        </p>
        <h1 className="h1">{contract.title}</h1>
        <p className="lead">{contract.story}</p>
      </header>

      <div className="contract-grid">
        <div className="stack-4">
          <p className="brief">
            <FlaskConical size={16} aria-hidden /> {challenge.brief}
          </p>
          <CodeBlock code={challenge.code} focusLines={challenge.focusLines} fileName={challenge.fileName} />
          {ran && choice && ran.choiceId === choice.id && <ChallengeFeedback choice={choice} results={ran.results} correct={ran.correct} contract={contract} />}
        </div>

        <div className="stack-4">
          {!solved || (ran && !ran.correct) ? (
            <fieldset className="choices">
              <legend className="h3">{challenge.question}</legend>
              {challenge.choices.map((c) => (
                <label key={c.id} className={`choice ${selected === c.id ? 'is-selected' : ''} ${ran?.choiceId === c.id ? (ran.correct ? 'is-correct' : 'is-wrong') : ''}`}>
                  <input
                    type="radio"
                    name="choice"
                    value={c.id}
                    checked={selected === c.id}
                    onChange={() => {
                      setSelected(c.id)
                      setRan(null)
                    }}
                  />
                  <span className="choice__key" aria-hidden>
                    {c.id.toUpperCase()}
                  </span>
                  <span className="choice__body">
                    <span className="choice__label">{c.label}</span>
                    <CodeBlock code={c.code} compact label={`Option ${c.id.toUpperCase()} code`} />
                  </span>
                </label>
              ))}
              <button type="button" className="btn btn--primary btn--lg btn--block" disabled={!choice} onClick={() => void run()}>
                <Play size={16} aria-hidden /> Run tests & submit
              </button>
              <p className="muted small center">Tests run against authored fixtures in your browser. Nothing you choose is executed from user input.</p>
            </fieldset>
          ) : null}

          {solved && (
            <div ref={missionCard} className="mission-teaser" tabIndex={-1}>
              <span className="mission-teaser__icon">
                <TreePine size={22} aria-hidden />
              </span>
              <p className="eyebrow eyebrow--accent">Final mission · Touch Grass</p>
              <h2 className="h2">{mission.title}</h2>
              <p>{mission.variants[0].instruction}</p>
              <p className="muted small">The code is done. The upgrade is outside. One photo — then pocket your phone.</p>
              <button type="button" className="btn btn--primary btn--lg btn--block" onClick={() => navigate('/explore')}>
                {status === 'completed' ? 'View mission' : 'Start mission'} <ArrowRight size={17} aria-hidden />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
