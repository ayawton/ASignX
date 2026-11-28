import { GAME_MODES, PACES, readArcadeBest } from './arcade.js'

export const PRESET_AVATARS = [
  { id: 'wave', label: 'Waving hand', tone: 'blue' },
  { id: 'love', label: 'Heart sign', tone: 'rose' },
  { id: 'owl', label: 'Night owl', tone: 'teal' },
  { id: 'fox', label: 'Clever fox', tone: 'amber' },
  { id: 'star', label: 'Bright star', tone: 'gold' },
  { id: 'rocket', label: 'Rocket', tone: 'navy' },
  { id: 'sprout', label: 'Growing sprout', tone: 'green' },
  { id: 'compass', label: 'Explorer compass', tone: 'blue' },
]

export const DEFAULT_AVATAR = 'wave'

export function normalizeAvatar(value) {
  return PRESET_AVATARS.some(item => item.id === value) ? value : DEFAULT_AVATAR
}

const LEVEL_TITLES = [
  'First Signer',
  'Hand Builder',
  'Phrase Finder',
  'Sign Explorer',
  'Fluent Starter',
  'Sign Master',
]

export function levelFromXp(rawXp) {
  const totalXp = Math.max(0, Math.floor(Number(rawXp) || 0))
  let level = 1
  let remaining = totalXp
  let nextLevelXp = 100
  while (remaining >= nextLevelXp) {
    remaining -= nextLevelXp
    level += 1
    nextLevelXp = level * 100
  }
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)]
  const percent = Math.min(100, Math.round((remaining / nextLevelXp) * 100))
  return {
    level,
    title,
    totalXp,
    currentXp: remaining,
    nextLevelXp,
    remainingXp: nextLevelXp - remaining,
    percent,
  }
}

export function resolveFeaturedBadges(earnedBadges = [], featuredIds = []) {
  if (!Array.isArray(earnedBadges) || !earnedBadges.length) return []
  const byId = new Map(earnedBadges.map(badge => [badge.id, badge]))
  const picked = []
  if (Array.isArray(featuredIds)) {
    for (const id of featuredIds) {
      const badge = byId.get(id)
      if (badge && !picked.some(item => item.id === badge.id) && picked.length < 3) {
        picked.push(badge)
      }
    }
  }
  if (picked.length) return picked
  return earnedBadges.slice(0, 3)
}

function bestForInput(mode, input) {
  let bestScore = 0
  let bestPace = null
  for (const [paceKey, pace] of Object.entries(PACES)) {
    const score = readArcadeBest(mode, paceKey, input)
    if (score > bestScore) {
      bestScore = score
      bestPace = pace.label
    }
  }
  return { score: bestScore, pace: bestPace }
}

export function readMinigameHighscores() {
  return Object.entries(GAME_MODES).map(([key, mode]) => ({
    key,
    title: mode.title,
    camera: bestForInput(key, 'camera'),
    keyboard: bestForInput(key, 'keyboard'),
  }))
}
