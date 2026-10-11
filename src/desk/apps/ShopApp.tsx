import { Check, Eye, Lock } from 'lucide-react'
import { useGame } from '../../app/GameContext.tsx'
import { SHOP } from '../../content/shop.ts'
import { levelForXp } from '../../game/levels.ts'

export default function ShopApp({ onLookAround }: { onLookAround?: () => void }) {
  const { profile, buy, notify } = useGame()
  const level = levelForXp(profile.xp).level
  const groups = [
    { title: 'Plants', note: 'Paid with fresh-air tokens 🌿 — only earned outside.', items: SHOP.filter((i) => i.currency === 'tokens') },
    { title: 'Gear', note: 'Paid with money from client jobs.', items: SHOP.filter((i) => i.currency === 'money') },
  ]
  return (
    <div className="shop">
      <header className="app-head row-between">
        <div>
          <h2>Shop</h2>
          <p className="muted small">Everything you buy appears in your office.</p>
        </div>
        {onLookAround && (
          <button type="button" className="btn btn--sm" onClick={onLookAround}>
            <Eye size={14} aria-hidden /> Look around
          </button>
        )}
      </header>
      {groups.map((g) => (
        <section key={g.title} className="shop__group" aria-label={g.title}>
          <p className="eyebrow">
            {g.title} <span className="muted">— {g.note}</span>
          </p>
          <div className="shop__grid">
            {g.items.map((item) => {
              const owned = profile.upgrades.includes(item.id)
              const locked = level < item.minLevel
              const balance = item.currency === 'tokens' ? profile.tokens : profile.money
              const price = item.currency === 'tokens' ? `${item.price} 🌿` : `$${item.price}`
              return (
                <article key={item.id} className={`shop-item ${owned ? 'is-owned' : ''}`}>
                  <h3>{item.name}</h3>
                  <p className="muted small">{item.blurb}</p>
                  <div className="row-between">
                    <span className="shop-item__price">{price}</span>
                    {owned ? (
                      <span className="pill pill--ok">
                        <Check size={12} aria-hidden /> In office
                      </span>
                    ) : locked ? (
                      <span className="pill">
                        <Lock size={11} aria-hidden /> Level {item.minLevel}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--sm btn--primary"
                        disabled={balance < item.price}
                        title={balance < item.price ? (item.currency === 'tokens' ? 'Earn tokens with a walk outside' : 'Earn money with client jobs') : undefined}
                        onClick={async () => {
                          const err = await buy(item.id)
                          if (err === 'funds') notify('warn', 'Not enough yet.')
                        }}
                      >
                        Buy
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
