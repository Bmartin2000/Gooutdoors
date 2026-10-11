import { ArrowRight, Check, Circle, Lock, Sparkles, Sprout } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '../app/GameContext.tsx'
import { useShell } from '../app/shell.ts'
import { CONTRACTS, getMission } from '../content/contracts.ts'
import { S } from '../content/strings.ts'
import { LEVELS, levelProgress, TOOLS } from '../game/levels.ts'
import { contractStatus, currentContract } from '../game/rewardEngine.ts'
import type { PlayerProfile } from '../game/types.ts'
import WorkspaceStage from '../scene/WorkspaceStage.tsx'

function ProgressOverlay({ profile }: { profile: PlayerProfile }) {
  const { current, next, ratio } = levelProgress(profile.xp)
  return (
    <div className="progress-overlay">
      <div className="progress-overlay__level">
        <span className="progress-overlay__num">L{current.level}</span>
        <div>
          <p className="progress-overlay__name">{current.name}</p>
          <p className="progress-overlay__xp">
            {profile.xp} XP{next ? ` · ${next.minXp - profile.xp} to ${next.name}` : ' · max level'}
          </p>
        </div>
      </div>
      <div
        className="xpbar"
        role="progressbar"
        aria-label="Progress to next level"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio * 100)}
      >
        <span style={{ transform: `scaleX(${Math.max(0.02, ratio)})` }} />
      </div>
    </div>
  )
}

function ContractsPanel() {
  const { profile, evidence, startContract } = useGame()
  const navigate = useNavigate()
  const contract = currentContract(profile)

  if (!contract) {
    return (
      <section className="card card--pad contract-panel" aria-labelledby="contract-title">
        <p className="eyebrow eyebrow--accent">Studio complete</p>
        <h2 id="contract-title" className="h2">
          {S.workspace.allDone}
        </h2>
        <p className="muted">All three tools are yours — and the outdoors is still the best debugger. Come back anytime.</p>
        <button type="button" className="btn btn--primary btn--lg" onClick={() => navigate('/companion')}>
          {S.workspace.allDoneCta} <ArrowRight size={17} aria-hidden />
        </button>
      </section>
    )
  }

  const status = contractStatus(profile, contract.id)
  const mission = getMission(contract.missionId)
  const pending = evidence.find((e) => e.contractId === contract.id && e.status !== 'verified')
  const cta =
    status === 'available'
      ? { label: S.workspace.startContract, run: async () => (await startContract(contract.id), navigate(`/contracts/${contract.id}`)) }
      : status === 'coding'
        ? { label: S.workspace.continueContract, run: async () => navigate(`/contracts/${contract.id}`) }
        : { label: pending ? S.workspace.verifyPending : S.workspace.startMission, run: async () => navigate('/explore') }

  return (
    <section className="card card--pad contract-panel" aria-labelledby="contract-title">
      <div className="row-between">
        <p className="eyebrow">{S.workspace.contractEyebrow}</p>
        <span className="pill">{contract.difficulty}</span>
      </div>
      <h2 id="contract-title" className="h2">
        {contract.title}
      </h2>
      <p className="muted">{contract.story}</p>
      <ol className="steps" aria-label="Contract steps">
        <li className={status === 'mission' ? 'is-done' : status === 'coding' || status === 'available' ? 'is-current' : ''}>
          <span className="steps__dot">{status === 'mission' ? <Check size={12} /> : 1}</span>
          Code · {contract.estimate}
        </li>
        <li className={status === 'mission' ? 'is-current' : ''}>
          <span className="steps__dot">2</span>
          Outside · {mission?.title}
        </li>
        <li>
          <span className="steps__dot">3</span>
          Unlock · {TOOLS.find((t) => t.id === contract.reward.toolId)?.name}
        </li>
      </ol>
      <button type="button" className="btn btn--primary btn--lg btn--block" onClick={() => void cta.run()}>
        {cta.label} <ArrowRight size={17} aria-hidden />
      </button>
    </section>
  )
}

export default function WorkspacePage() {
  const { profile } = useGame()
  const { reducedMotion } = useShell()
  const navigate = useNavigate()
  const level = LEVELS.find((l) => l.roomStage === profile.roomStage)!
  const unlocked = TOOLS.filter((t) => profile.unlockedToolIds.includes(t.id))

  return (
    <div className="page page--workspace">
      <section className={`stage-card stage-card--${profile.roomStage}`} aria-label={`Your workspace: ${level.name}. ${level.description}`}>
        <div className="stage-card__canvas">
          <WorkspaceStage stage={profile.roomStage} reducedMotion={reducedMotion} />
        </div>
        <ProgressOverlay profile={profile} />
        <div className="stage-card__caption">
          <span className="eyebrow">Room · stage {profile.roomStage + 1} of 4</span>
          <p>{level.description}</p>
        </div>
      </section>

      <div className="workspace-side">
        <ContractsPanel />

        <section className="card card--pad stack-3" aria-labelledby="tools-title">
          <div className="row-between">
            <h2 id="tools-title" className="section-title">
              {S.workspace.tools}
            </h2>
            <span className="muted small">
              {unlocked.length} / {TOOLS.length}
            </span>
          </div>
          <ul className="tool-mini">
            {TOOLS.map((t) => {
              const on = profile.unlockedToolIds.includes(t.id)
              return (
                <li key={t.id}>
                  <button type="button" className={`tool-mini__item ${on ? 'is-on' : ''}`} onClick={() => navigate(`/companion?tool=${t.id}`)}>
                    {on ? <Sparkles size={14} aria-hidden /> : <Lock size={14} aria-hidden />}
                    {t.name}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="card card--pad stack-2" aria-labelledby="recent-title">
          <h2 id="recent-title" className="section-title">
            {S.workspace.recent}
          </h2>
          {profile.lastAchievement ? (
            <div className="milestone">
              <span className="milestone__icon">
                <Sprout size={18} aria-hidden />
              </span>
              <div>
                <p className="milestone__title">{profile.lastAchievement.title}</p>
                <p className="muted small">{profile.lastAchievement.detail}</p>
              </div>
            </div>
          ) : (
            <p className="muted small">{S.workspace.none}</p>
          )}
          <ol className="timeline" aria-label="Contracts">
            {CONTRACTS.map((c) => {
              const st = contractStatus(profile, c.id)
              return (
                <li key={c.id} className={`timeline__item is-${st}`}>
                  {st === 'completed' ? <Check size={13} aria-hidden /> : st === 'locked' ? <Lock size={12} aria-hidden /> : <Circle size={11} aria-hidden />}
                  <span>{c.title}</span>
                  <span className="sr-only">({st})</span>
                </li>
              )
            })}
          </ol>
        </section>
      </div>
    </div>
  )
}
