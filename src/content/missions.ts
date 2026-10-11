import type { OutdoorMission } from '../game/types.ts'

const SAFETY = [
  'Stay on public paths and places you are allowed to be.',
  'Keep away from traffic, water edges, rail lines and construction sites.',
  'Look, don’t pick: leave plants and animals as you found them.',
  'Pocket the phone while you walk. It will buzz when a mission appears.',
]

/** Photo missions that pop up during a walk. Each is checked by the local vision model at the desk. */
export const MISSIONS: OutdoorMission[] = [
  {
    id: 'natures-debugger',
    title: 'Nature’s Debugger',
    variants: [
      {
        id: 'crack-growth',
        title: 'Growth through a crack',
        instruction: 'Find something growing through or around a crack — nature patching a broken system.',
        visualCriteria:
          'a living plant, grass, weed or moss growing in, through, or right next to a crack, gap or seam in a built surface such as pavement, asphalt, a wall, steps or a curb',
      },
      {
        id: 'green-signal',
        title: 'Any green signal',
        instruction: 'Photograph one living plant — a street weed, a tree, a leaf or a balcony plant all count.',
        visualCriteria:
          'real living plants (a tree, shrub, weed, grass, moss, leaf or flower) clearly visible as a main subject of a real photograph — any distance is fine, it does not need to be a close-up',
      },
    ],
    safety: SAFETY,
    rewardTokens: 2,
    rewardXp: 40,
  },
  {
    id: 'pattern-hunter',
    title: 'Pattern Hunter',
    variants: [
      {
        id: 'natural-pattern',
        title: 'Repeating pattern',
        instruction: 'Find a natural repeating pattern — leaf veins, tree bark, petals or a pine cone.',
        visualCriteria:
          'a natural object showing a clearly repeating or self-similar pattern, such as leaf veins, bark texture, petals, a pine cone, a fern, seeds or a succulent rosette',
      },
      {
        id: 'green-signal',
        title: 'Any green signal',
        instruction: 'Photograph one living plant — a street weed, a tree, a leaf or a balcony plant all count.',
        visualCriteria:
          'real living plants (a tree, shrub, weed, grass, moss, leaf or flower) clearly visible as a main subject of a real photograph — any distance is fine',
      },
    ],
    safety: SAFETY,
    rewardTokens: 2,
    rewardXp: 40,
  },
  {
    id: 'test-the-wild',
    title: 'Test the Wild',
    variants: [
      {
        id: 'side-by-side',
        title: 'Side-by-side test',
        instruction: 'Find two different leaves and photograph them side by side — nature’s comparison test.',
        visualCriteria: 'at least two leaves, petals or flowers shown together that visibly differ in shape, size or color',
      },
      {
        id: 'weathered',
        title: 'Weather-tested',
        instruction: 'Photograph something natural that has been tested by weather — bark, a fallen leaf or lichen.',
        visualCriteria:
          'a natural object visibly shaped by weather or time, such as a fallen or dried leaf, cracked bark, lichen on stone or wood, or a weathered branch',
      },
    ],
    safety: SAFETY,
    rewardTokens: 3,
    rewardXp: 60,
  },
]

export function getMission(id: string) {
  return MISSIONS.find((m) => m.id === id)
}

export function getVariant(missionId: string, variantId: string | undefined) {
  const mission = getMission(missionId)
  return mission?.variants.find((v) => v.id === variantId) ?? mission?.variants[0]
}
