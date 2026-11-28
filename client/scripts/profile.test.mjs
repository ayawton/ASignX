import assert from 'node:assert/strict'
import { DEFAULT_AVATAR, PRESET_AVATARS, levelFromXp, normalizeAvatar, resolveFeaturedBadges } from '../src/data/profile.js'

assert.ok(PRESET_AVATARS.length >= 6)
assert.equal(normalizeAvatar('owl'), 'owl')
assert.equal(normalizeAvatar('unknown-avatar'), DEFAULT_AVATAR)

assert.deepEqual(levelFromXp(0), {
  level: 1,
  title: 'First Signer',
  totalXp: 0,
  currentXp: 0,
  nextLevelXp: 100,
  remainingXp: 100,
  percent: 0,
})

assert.deepEqual(levelFromXp(100), {
  level: 2,
  title: 'Hand Builder',
  totalXp: 100,
  currentXp: 0,
  nextLevelXp: 200,
  remainingXp: 200,
  percent: 0,
})

assert.deepEqual(levelFromXp(350), {
  level: 3,
  title: 'Phrase Finder',
  totalXp: 350,
  currentXp: 50,
  nextLevelXp: 300,
  remainingXp: 250,
  percent: 17,
})

const earned = [
  { id: 'a1', name: 'One' },
  { id: 'a2', name: 'Two' },
  { id: 'a3', name: 'Three' },
  { id: 'a4', name: 'Four' },
]

assert.deepEqual(resolveFeaturedBadges(earned, []).map(b => b.id), ['a1', 'a2', 'a3'])
assert.deepEqual(resolveFeaturedBadges(earned, ['a4', 'missing', 'a2', 'a4']).map(b => b.id), ['a4', 'a2'])
assert.deepEqual(resolveFeaturedBadges([], ['a1']), [])

console.log('profile tests passed')
