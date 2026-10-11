/** Determinisztikus, függőségmentes magasságfüggvény a low-poly tájhoz. */
export function terrainHeight(x: number, z: number): number {
  const ridge = Math.sin(x * 0.18) * Math.cos(z * 0.15) * 2.2
  const hills = Math.sin(x * 0.45 + z * 0.3) * 0.6 + Math.cos(z * 0.5 - x * 0.2) * 0.5
  // Hátul magas hegyvonulat, elöl lankás völgy a tóval
  const mountains = Math.max(0, -z - 4) * 0.55 * (1 + Math.sin(x * 0.35) * 0.45)
  return ridge + hills + mountains
}

/** Egyszerű seedelt pszeudo-véletlen (mulberry32), hogy a fák helye stabil legyen. */
export function seededRandom(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const WATER_LEVEL = -0.6
