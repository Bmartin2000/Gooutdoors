import { BadgeCheck, Coins, Footprints, Gauge, ShieldAlert, TrendingUp, Zap } from 'lucide-react'
import { useGame } from '../../app/GameContext.tsx'
import { getMission } from '../../content/missions.ts'

export default function AdminApp() {
  const { profile, evidence, adminActions, session } = useGame()
  const pending = evidence.filter((e) => e.status !== 'verified' && e.status !== 'verifying')
  const actions = [
    { icon: Footprints, title: 'Skip a walk', text: 'Credit one walk as done: energy 100, tokens and XP.', run: adminActions.walk },
    { icon: BadgeCheck, title: `Approve all photos (${pending.length})`, text: 'Mark waiting photos as approved without the AI check.', run: adminActions.approveAllPhotos, disabled: !pending.length },
    { icon: Gauge, title: 'Complete the active job', text: profile.activeJob ? `Finish “${profile.activeJob.offer.title}” and get paid.` : 'Accept a job first.', run: adminActions.finishJob, disabled: !profile.activeJob },
    { icon: Zap, title: 'Refill energy', text: 'Energy back to 100.', run: adminActions.refill },
    { icon: TrendingUp, title: 'Level up', text: 'Jump to the next level (unlocks tools and shop items).', run: adminActions.levelUp },
    { icon: Coins, title: '+5 🌿  +$200', text: 'Top up tokens and money for the shop.', run: () => adminActions.grant(5, 200) },
  ]
  return (
    <div className="admin">
      <header className="app-head">
        <h2>Admin</h2>
        <p className="muted small">Signed in as {session?.user}. Skip any step to test the loop quickly.</p>
      </header>
      <p className="note note--warn admin__warn">
        <ShieldAlert size={15} aria-hidden /> Every override is logged as “Admin override” in your activity feed. Skipped walks are not GPS-verified and approved photos are not checked by the AI —
        don’t present them as real in a demo.
      </p>
      <div className="admin__grid">
        {actions.map(({ icon: Icon, title, text, run, disabled }) => (
          <button key={title} type="button" className="admin__action" disabled={disabled} onClick={() => void run()}>
            <Icon size={18} aria-hidden />
            <strong>{title}</strong>
            <span className="muted small">{text}</span>
          </button>
        ))}
      </div>
      {pending.length > 0 && (
        <section className="stack-2">
          <p className="eyebrow">Waiting photos</p>
          {pending.map((e) => (
            <div key={e.id} className="admin__row">
              <span className="small">
                {getMission(e.missionId)?.title} · {new Date(e.capturedAt).toLocaleString('en', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
              <button type="button" className="btn btn--sm" onClick={() => void adminActions.approvePhoto(e.id)}>
                Approve
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
