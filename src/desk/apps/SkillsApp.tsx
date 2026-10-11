import { useGame } from '../../app/GameContext.tsx'
import { SKILLS } from '../../content/challenges.ts'
import { pointsToNext, SKILL_THRESHOLDS, trainingCost } from '../../game/economy.ts'
import { useState } from 'react'
import { LEVELS, levelProgress, TOOLS } from '../../game/levels.ts'

export default function SkillsApp() {
  const { profile, train, notify, openApp } = useGame()
  const [training, setTraining] = useState(false)
  const { current, next, ratio } = levelProgress(profile.xp)
  return (
    <div className="app-grid">
      <section className="app-col" aria-labelledby="skills-title">
        <header className="app-head">
          <h2 id="skills-title">Skills</h2>
          <p className="muted small">Jobs earn practice points for free. Spend money, fresh air and 5 energy to train any skill yourself. Ten skill ranks unlock better contracts.</p>
        </header>
        <ul className="skills">
          {SKILLS.map((s) => {
            const lvl = profile.skills[s.id]
            const pts = profile.skillPoints[s.id]
            const need = pointsToNext(pts)
            const cost = trainingCost(pts)
            const reason = need === null ? 'Mastered' : profile.money < cost.money ? `Need $${cost.money - profile.money} more` : profile.tokens < cost.tokens ? 'Earn 1 🌿 outside' : profile.energy < cost.energy ? 'Recharge outside' : null
            return (
              <li key={s.id}>
                <div className="row-between">
                  <strong>{s.name}</strong>
                  <span className="muted small">
                    Level {lvl}
                    {need !== null ? ` · ${need} pt to next` : ' · max'}
                  </span>
                </div>
                <div className="skill-pips" aria-label={`${s.name} level ${lvl} of ${SKILL_THRESHOLDS.length}`}>
                  {SKILL_THRESHOLDS.map((_, index) => index + 1).map((i) => (
                    <i key={i} className={i <= lvl ? 'is-on' : ''} />
                  ))}
                </div>
                <p className="small muted">{pts} practice points · {need === null ? 'Mastered!' : `Next rank in ${need} points`}</p>
                {need !== null && <button type="button" className="btn btn--sm btn--primary" disabled={training || !!reason} onClick={async () => {
                  setTraining(true)
                  try { const error = await train(s.id); if (error) notify('warn', `Training unavailable: ${error}`) } finally { setTraining(false) }
                }}>Train +1 · ${cost.money} + 1 🌿 + 5 energy</button>}
                {reason && need !== null && <button type="button" className="btn btn--sm btn--ghost" onClick={() => openApp(profile.money < cost.money ? 'inbox' : 'outside')}>{reason} →</button>}
              </li>
            )
          })}
        </ul>
      </section>
      <aside className="app-col app-col--side">
        <div className="level-card">
          <p className="eyebrow">Career</p>
          <p className="level-card__big">
            L{current.level} <span>{current.name}</span>
          </p>
          <div className="meter meter--big meter--xp" aria-hidden>
            <span style={{ transform: `scaleX(${Math.max(0.02, ratio)})` }} />
          </div>
          <p className="muted small">{next ? `${profile.xp} XP · ${next.minXp - profile.xp} to ${next.name}` : `${profile.xp} XP · top level`}</p>
        </div>
        <dl className="stats">
          <div>
            <dt>Jobs done</dt>
            <dd>{profile.jobsDone}</dd>
          </div>
          <div>
            <dt>Walks</dt>
            <dd>{profile.walksVerified}</dd>
          </div>
          <div>
            <dt>Minutes outside</dt>
            <dd>{profile.minutesOutside}</dd>
          </div>
          <div>
            <dt>Earned</dt>
            <dd>${profile.money.toLocaleString('en')}</dd>
          </div>
        </dl>
        <div className="unlocks">
          <p className="eyebrow">Unlocks</p>
          <ul>
            {LEVELS.slice(1).map((l) => {
              const tool = TOOLS.find((t) => t.minLevel === l.level)
              return (
                <li key={l.level} className={current.level >= l.level ? 'is-done' : ''}>
                  L{l.level} {l.name}
                  {tool ? ` — ${tool.name}` : ' — bigger contracts'}
                </li>
              )
            })}
          </ul>
        </div>
      </aside>
    </div>
  )
}
