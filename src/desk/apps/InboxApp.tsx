import { Clock3, Lock, Zap } from 'lucide-react'
import { useGame } from '../../app/GameContext.tsx'
import { getChallenge, skillName } from '../../content/challenges.ts'
import { eligibility } from '../../game/economy.ts'
import type { FeedItem, JobOffer } from '../../game/types.ts'

function timeLeft(iso: string) {
  const min = Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 60_000))
  return min >= 120 ? `${Math.round(min / 60)} h left` : `${min} min left`
}

function ago(iso: string) {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (min < 1) return 'now'
  if (min < 60) return `${min}m`
  return `${Math.round(min / 60)}h`
}

const FEED_ICON: Record<FeedItem['kind'], string> = {
  'job-arrived': '✉',
  'job-done': '$',
  'job-failed': '×',
  walk: '🌿',
  photo: '📷',
  purchase: '＋',
  level: '★',
  info: '•',
}

function OfferCard({ offer }: { offer: JobOffer }) {
  const { profile, accept, decline, notify, openApp } = useGame()
  const challenge = getChallenge(offer.challengeId)
  if (!challenge) return null
  const elig = eligibility(profile, challenge)
  const busy = !!profile.activeJob
  const tired = profile.energy < offer.energyCost
  const reasons = [
    ...(elig.missingLevel ? [`Level ${elig.missingLevel}`] : []),
    ...elig.missingSkills.map((m) => `${skillName(m.skill)} ${m.need}`),
  ]

  const onAccept = async () => {
    const error = await accept(offer.id)
    if (error === 'no-energy') notify('warn', 'Not enough energy. A walk outside refills it completely.')
    if (error === 'busy') notify('info', 'Finish or hand back your current job first.')
  }

  return (
    <article className={`offer ${elig.ok ? '' : 'is-locked'}`}>
      <div className="offer__avatar" aria-hidden>
        {offer.client[0]}
      </div>
      <div className="offer__body">
        <p className="offer__client">
          {offer.client} <span className="muted">· {timeLeft(offer.expiresAt)}</span>
        </p>
        <h3 className="offer__title">{offer.title}</h3>
        <p className="offer__pitch">{offer.pitch}</p>
        <div className="offer__chips">
          {(Object.entries(challenge.requires) as [string, number][]).map(([s, lvl]) => (
            <span key={s} className={`chip-s ${profile.skills[s as keyof typeof profile.skills] >= lvl ? 'is-ok' : 'is-missing'}`}>
              {skillName(s as never)} {lvl}
            </span>
          ))}
          {challenge.minLevel > 1 && <span className={`chip-s ${elig.missingLevel ? 'is-missing' : 'is-ok'}`}>Level {challenge.minLevel}</span>}
          <span className="chip-s chip-s--train">Trains {challenge.trains.map(skillName).join(', ')}</span>
        </div>
        {!elig.ok && (
          <p className="offer__lock">
            <Lock size={12} aria-hidden /> Needs {reasons.join(' · ')}. Take jobs that train it, or level up outside.
          </p>
        )}
      </div>
      <div className="offer__side">
        <p className="offer__pay">${offer.pay}</p>
        <p className="offer__meta">+{offer.xp} XP</p>
        <p className={`offer__meta ${tired ? 'is-low' : ''}`}>
          <Zap size={11} aria-hidden /> {offer.energyCost}
        </p>
        {elig.ok ? (
          tired ? (
            <button type="button" className="btn btn--sm" onClick={() => openApp('outside')}>
              Recharge outside
            </button>
          ) : (
            <button type="button" className="btn btn--sm btn--primary" onClick={() => void onAccept()} disabled={busy} title={busy ? 'You already have an active job' : undefined}>
              Accept
            </button>
          )
        ) : (
          <button type="button" className="btn btn--sm" disabled>
            Locked
          </button>
        )}
        <button type="button" className="offer__decline" onClick={() => void decline(offer.id)}>
          Decline
        </button>
      </div>
    </article>
  )
}

export default function InboxApp() {
  const { profile, settings, openApp } = useGame()
  const every = settings.jobEveryMin === 60 ? 'every hour' : `every ${settings.jobEveryMin} min`
  const nextIn = Math.max(0, Math.round((Date.parse(profile.lastArrivalAt) + settings.jobEveryMin * 60_000 - Date.now()) / 60_000))

  return (
    <div className="app-grid">
      <section className="app-col" aria-labelledby="offers-title">
        <header className="app-head">
          <h2 id="offers-title">Job offers</h2>
          <p className="muted small">
            <Clock3 size={12} aria-hidden /> New work arrives {every} · next in ~{nextIn} min
          </p>
        </header>
        {profile.activeJob && (
          <button type="button" className="active-job" onClick={() => openApp('work')}>
            <span className="eyebrow eyebrow--accent">In progress</span>
            <strong>{profile.activeJob.offer.title}</strong>
            <span className="muted small">{profile.activeJob.offer.client} · open Work →</span>
          </button>
        )}
        {profile.board.length === 0 ? (
          <div className="empty">
            <p>Inbox zero. New offers arrive {every}.</p>
            <p className="muted small">A good moment to step outside — energy and fresh-air tokens are waiting there.</p>
            <button type="button" className="btn btn--sm btn--primary" onClick={() => openApp('outside')}>
              Go outside
            </button>
          </div>
        ) : (
          <div className="offers">{profile.board.map((o) => <OfferCard key={o.id} offer={o} />)}</div>
        )}
      </section>

      <aside className="app-col app-col--side" aria-label="Status and activity">
        <div className={`energy-card ${profile.energy < 30 ? 'is-low' : ''}`}>
          <div className="row-between">
            <span className="eyebrow">Energy</span>
            <strong>{profile.energy}/100</strong>
          </div>
          <div className="meter meter--big" aria-hidden>
            <span style={{ transform: `scaleX(${profile.energy / 100})` }} />
          </div>
          <p className="small muted">{profile.energy < 30 ? 'Running low. A verified walk refills it to 100.' : 'Every job uses energy. A walk outside refills it.'}</p>
          <button type="button" className="btn btn--sm btn--block" onClick={() => openApp('outside')}>
            Take a walk
          </button>
        </div>
        <div className="feed">
          <p className="eyebrow">Activity</p>
          <ul>
            {profile.feed.slice(0, 8).map((f) => (
              <li key={f.id}>
                <span className={`feed__icon feed__icon--${f.kind}`} aria-hidden>
                  {FEED_ICON[f.kind]}
                </span>
                <span className="feed__text">{f.text}</span>
                <span className="feed__time">{ago(f.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}
