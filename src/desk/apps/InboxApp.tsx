import { Clock3, Lock, Zap } from 'lucide-react'
import { useGame } from '../../app/GameContext.tsx'
import { getChallenge, skillName } from '../../content/challenges.ts'
import { eligibility, jobTerms } from '../../game/economy.ts'
import { levelProgress } from '../../game/levels.ts'
import { SHOP, PLANT_IDS } from '../../content/shop.ts'
import { MossFace } from '../MossBubble.tsx'
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
  const terms = jobTerms(profile, offer)
  const busy = !!profile.activeJob
  const tired = profile.energy < terms.energyCost
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
    <article className={`offer ${elig.ok ? '' : 'is-locked'} ${offer.featured ? 'is-featured' : ''}`}>
      <div className="offer__avatar" aria-hidden>
        {offer.client[0]}
      </div>
      <div className="offer__body">
        {offer.featured && <p className="offer__featured">★ Today’s contract · 1.5× pay</p>}
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
            <Lock size={12} aria-hidden /> Needs {reasons.join(' · ')}. Train in Skills or gain XP outside.
          </p>
        )}
      </div>
      <div className="offer__side">
        <p className="offer__pay">${terms.pay}</p>
        <p className="offer__meta">+{terms.xp} XP</p>
        <p className={`offer__meta ${tired ? 'is-low' : ''}`}>
          <Zap size={11} aria-hidden /> {terms.energyCost}
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
          <button type="button" className="btn btn--sm" onClick={() => openApp('skills')}>
            Train skills
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
  const { current, next, ratio } = levelProgress(profile.xp)
  const plants = profile.upgrades.filter((id) => PLANT_IDS.includes(id)).length
  const goalItem = SHOP.find((i) => i.minLevel <= current.level && !profile.upgrades.includes(i.id))

  return (
    <div className="inbox-home">
      <section className="journey" aria-label="Your next goals">
        <div className="journey__friend"><MossFace /><span>Grow with Moss</span></div>
        <h2>From a little desk to a living forest.</h2>
        <p className="muted">Solve jobs → earn money, XP and skills. Walk → refill energy and earn 🌿. Buy upgrades → grow your office and boost your rewards.</p>
        <div className="journey__steps">
          <button onClick={() => openApp(profile.activeJob ? 'work' : 'inbox')}><b>01 · Build your career</b><span>{current.name} · {next ? `${next.minXp - profile.xp} XP to ${next.name}` : 'Keep growing'}</span><div className="meter meter--xp"><span style={{ transform: `scaleX(${ratio})` }} /></div></button>
          <button onClick={() => openApp('outside')}><b>02 · Bring back fresh air</b><span>{profile.walksVerified} walks · 10 min + 150 m → full energy + 3 🌿</span></button>
          <button onClick={() => openApp('shop')}><b>03 · Grow your sanctuary</b><span>{plants}/{PLANT_IDS.length} plants · {goalItem ? `Next: ${goalItem.name} (${goalItem.currency === 'money' ? '$' : '🌿 '}${goalItem.price})` : 'Your forest is flourishing. Keep building mastery!'}</span></button>
        </div>
      </section>
    <div className="app-grid">
      <section className="app-col" aria-labelledby="offers-title">
        <header className="app-head">
          <h2 id="offers-title">Job offers</h2>
          <p className="muted small">
            <Clock3 size={12} aria-hidden /> Playable jobs refill immediately · bonus offers {every} (~{nextIn} min)
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
    </div>
  )
}
