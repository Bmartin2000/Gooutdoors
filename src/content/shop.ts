import type { UpgradeId } from '../game/types.ts'

export interface Perk {
  /** Multiplier on job pay, e.g. 0.1 = +10 %. */
  pay?: number
  /** Multiplier on job XP. */
  xp?: number
  /** Energy saved on every accepted job. */
  energyDiscount?: number
  /** Extra passive energy per hour at the desk. */
  regen?: number
  /** Extra fresh-air tokens for every verified walk. */
  walkTokens?: number
}

export interface ShopItem {
  id: UpgradeId
  name: string
  blurb: string
  /** What it does for you — shown on the card. */
  perkText: string
  perk: Perk
  /** Plants are paid in fresh-air tokens (earned outside); gear in money (earned at the desk). */
  currency: 'tokens' | 'money'
  price: number
  minLevel: number
  plant: boolean
}

export const SHOP: ShopItem[] = [
  { id: 'desk-seedling', name: 'Desk seedling', blurb: 'A first bit of green beside the keyboard.', perkText: '+3 energy / hour', perk: { regen: 3 }, currency: 'tokens', price: 2, minLevel: 1, plant: true },
  { id: 'floor-plant', name: 'Monstera', blurb: 'Big leaves in the corner by the window.', perkText: '+1 🌿 per walk', perk: { walkTokens: 1 }, currency: 'tokens', price: 4, minLevel: 1, plant: true },
  { id: 'hanging-plant', name: 'Hanging pothos', blurb: 'Trailing vines from the ceiling.', perkText: '+4 energy / hour', perk: { regen: 4 }, currency: 'tokens', price: 5, minLevel: 2, plant: true },
  { id: 'moss-rug', name: 'Moss rug', blurb: 'Soft green underfoot.', perkText: '−3 energy per job', perk: { energyDiscount: 3 }, currency: 'tokens', price: 6, minLevel: 3, plant: true },
  { id: 'terrarium', name: 'Terrarium', blurb: 'A tiny glass forest on the shelf.', perkText: '+5 % XP', perk: { xp: 0.05 }, currency: 'tokens', price: 7, minLevel: 4, plant: true },
  { id: 'wall-vines', name: 'Wall vines', blurb: 'Green climbing across the walls.', perkText: '+1 🌿 per walk', perk: { walkTokens: 1 }, currency: 'tokens', price: 8, minLevel: 5, plant: true },
  { id: 'big-plant', name: 'Fiddle-leaf fig', blurb: 'A tall tree for the other corner.', perkText: '+5 energy / hour', perk: { regen: 5 }, currency: 'tokens', price: 10, minLevel: 6, plant: true },
  { id: 'bonsai', name: 'Bonsai', blurb: 'Patience, shaped over years.', perkText: '+10 % XP', perk: { xp: 0.1 }, currency: 'tokens', price: 14, minLevel: 8, plant: true },
  { id: 'coffee', name: 'Pour-over coffee', blurb: 'A proper mug, a proper brew.', perkText: '−5 energy per job', perk: { energyDiscount: 5 }, currency: 'money', price: 80, minLevel: 1, plant: false },
  { id: 'desk-lamp', name: 'Warm desk lamp', blurb: 'Golden light for late commits.', perkText: '+10 % pay', perk: { pay: 0.1 }, currency: 'money', price: 150, minLevel: 2, plant: false },
  { id: 'headphones', name: 'Studio headphones', blurb: 'Focus mode, on the desk.', perkText: '+15 % XP', perk: { xp: 0.15 }, currency: 'money', price: 220, minLevel: 3, plant: false },
  { id: 'poster', name: 'Trail map poster', blurb: 'A reminder of where you could be.', perkText: '+1 🌿 per walk', perk: { walkTokens: 1 }, currency: 'money', price: 180, minLevel: 3, plant: false },
  { id: 'bookshelf', name: 'Bookshelf', blurb: 'Every book you meant to read.', perkText: '+10 % XP', perk: { xp: 0.1 }, currency: 'money', price: 380, minLevel: 4, plant: false },
  { id: 'second-monitor', name: 'Second monitor', blurb: 'More pixels for bigger contracts.', perkText: '+20 % pay', perk: { pay: 0.2 }, currency: 'money', price: 520, minLevel: 5, plant: false },
  { id: 'string-lights', name: 'String lights', blurb: 'Warm dots of light along the wall.', perkText: '+10 % pay', perk: { pay: 0.1 }, currency: 'money', price: 650, minLevel: 7, plant: false },
]

export function getShopItem(id: UpgradeId) {
  return SHOP.find((i) => i.id === id)!
}

/** Sum of every perk you own. */
export function perksFor(upgrades: readonly UpgradeId[]): Required<Perk> {
  const total = { pay: 0, xp: 0, energyDiscount: 0, regen: 0, walkTokens: 0 }
  for (const id of upgrades) {
    const p = SHOP.find((i) => i.id === id)?.perk
    if (!p) continue
    total.pay += p.pay ?? 0
    total.xp += p.xp ?? 0
    total.energyDiscount += p.energyDiscount ?? 0
    total.regen += p.regen ?? 0
    total.walkTokens += p.walkTokens ?? 0
  }
  return total
}

export const PLANT_IDS = SHOP.filter((i) => i.plant).map((i) => i.id)
