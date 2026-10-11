import type { UpgradeId } from '../game/types.ts'

export interface ShopItem {
  id: UpgradeId
  name: string
  blurb: string
  /** Plants are paid in fresh-air tokens (earned outside); tech in money (earned at the desk). */
  currency: 'tokens' | 'money'
  price: number
  minLevel: number
}

export const SHOP: ShopItem[] = [
  { id: 'desk-seedling', name: 'Desk seedling', blurb: 'A first bit of green beside the keyboard.', currency: 'tokens', price: 2, minLevel: 1 },
  { id: 'floor-plant', name: 'Monstera', blurb: 'Big leaves in the corner by the window.', currency: 'tokens', price: 4, minLevel: 1 },
  { id: 'hanging-plant', name: 'Hanging pothos', blurb: 'Trailing vines from the ceiling.', currency: 'tokens', price: 5, minLevel: 2 },
  { id: 'moss-rug', name: 'Moss rug', blurb: 'Soft green underfoot.', currency: 'tokens', price: 6, minLevel: 2 },
  { id: 'wall-vines', name: 'Wall vines', blurb: 'Green climbing across the walls.', currency: 'tokens', price: 8, minLevel: 3 },
  { id: 'big-plant', name: 'Fiddle-leaf fig', blurb: 'A tall tree for the other corner.', currency: 'tokens', price: 10, minLevel: 3 },
  { id: 'desk-lamp', name: 'Warm desk lamp', blurb: 'Golden light for late commits.', currency: 'money', price: 120, minLevel: 1 },
  { id: 'coffee', name: 'Pour-over coffee', blurb: 'A proper mug, a proper brew.', currency: 'money', price: 80, minLevel: 1 },
  { id: 'headphones', name: 'Studio headphones', blurb: 'Focus mode, on the desk.', currency: 'money', price: 200, minLevel: 2 },
  { id: 'poster', name: 'Trail map poster', blurb: 'A reminder of where you could be.', currency: 'money', price: 150, minLevel: 2 },
  { id: 'second-monitor', name: 'Second monitor', blurb: 'More pixels for bigger contracts.', currency: 'money', price: 450, minLevel: 3 },
]

export function getShopItem(id: UpgradeId) {
  return SHOP.find((i) => i.id === id)!
}
