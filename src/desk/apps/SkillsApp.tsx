import { useGame } from '../../app/GameContext.tsx'
import { SKILLS } from '../../content/challenges.ts'
import { pointsToNext } from '../../game/economy.ts'
import { LEVELS, levelProgress, TOOLS } from '../../game/levels.ts'

export default function SkillsApp() {
  const { profile } = useGame()
  const { current, next, ratio } = levelProgress(profile.xp)
  return (
    <div className="app-grid">
      <section className="app-col" aria-labelledby="skills-title">
        <header className="app-head">
          <h2 id="skills-title">Skills</h2>
          <p className="muted small">Jobs train the skills they use. Higher skills unlock better-paying offers.</p>
        </header>
        <ul className="skills">
          {SKILLS.map((s) => {
            const lvl = profile.skills[s.id]
            const pts = profile.skillPoints[s.id]
            const need = pointsToNext(pts)
            return (
              <li key={s.id}>
                <div className="row-between">
                  <strong>{s.name}</strong>
                  <span className="muted small">
                    Level {lvl}
                    {need !== null ? ` · ${need} pt to next` : ' · max'}
                  </span>
                </div>
                <div className="skill-pips" aria-label={`${s.name} level ${lvl} of 4`}>
                  {[1, 2, 3, 4].map((i) => (
                    <i key={i} className={i <= lvl ? 'is-on' : ''} />
                  ))}
                </div>
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
