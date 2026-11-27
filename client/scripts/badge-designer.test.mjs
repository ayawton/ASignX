import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { badgeTiers, defaultBadgeDesign, designOptions, designSignature, suggestedBadgeTier, unusedBadgeDesign } from '../src/data/badge-design.js'

const badge = { id: 'one', name: 'Lesson Explorer', description: 'Complete lessons.', metric: 'completed_lessons', threshold: 10, tier: 'advanced', milestone_group: 'Learning milestones', badge_design: { ...defaultBadgeDesign } }
const catalog = [{ ...badge, id: 'earlier', threshold: 1, tier: 'mastery' }, { ...badge, id: 'later', threshold: 25 }]
assert.equal(suggestedBadgeTier(badge, catalog), 'growing')
assert.equal(badge.tier, 'advanced', 'Suggesting a tier must not mutate a saved badge')
assert.equal(suggestedBadgeTier({ ...badge, milestone_group: null }, catalog), null, 'Standalone badges have no ordinal tier')
assert.equal(suggestedBadgeTier(badge, [...catalog, { ...badge, id: 'different-metric', metric: 'total_xp', threshold: 5 }]), 'growing')
assert.equal(designSignature(badge), designSignature({ ...badge, badge_design: { finish: 'classic', decoration: 'none', pattern: 'solid', border: 'double', version: 1 } }), 'Object key order does not change design identity')
const generated = []
for (let i = 0; i < 191; i++) {
 const recipe = unusedBadgeDesign(badge, [...catalog, ...generated], () => 0)
 assert.ok(recipe, 'An unused recipe should be available')
 const next = { ...badge, id: `new-${i}`, badge_design: recipe }
 assert.notEqual(designSignature(next), designSignature(badge))
 assert.ok(!generated.some(item => designSignature(item) === designSignature(next)))
 generated.push(next)
}
assert.equal(unusedBadgeDesign(badge, [...catalog, ...generated]), null, 'Exhaustion stops without an infinite shuffle loop')
console.log('PASS category/tier design identity, milestone suggestions, unused shuffle and exhaustion')

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
 const { BadgeArt, BadgeCard, BadgeCollection } = await vite.ssrLoadModule('/src/components/Achievements.jsx')
 const { default: BadgeDesigner } = await vite.ssrLoadModule('/src/components/BadgeDesigner.jsx')
 for (const tier of Object.keys(badgeTiers)) for (const border of designOptions.border) {
  const markup = renderToStaticMarkup(h(BadgeArt, { badge: { ...badge, tier, badge_design: { ...defaultBadgeDesign, border } } }))
  assert.ok(markup.includes('viewBox="0 0 128 144"'))
  assert.ok(markup.includes('clipPath') && markup.includes('lucide-book-open'))
  assert.ok(!markup.includes('<script') && !markup.includes('NaN'))
 }
 const pair = renderToStaticMarkup(h('div', null, h(BadgeArt, { badge }), h(BadgeArt, { badge })))
 const ids = [...pair.matchAll(/clipPath id="([^"]+)"/g)].map(match => match[1])
 assert.equal(new Set(ids).size, 2, 'Repeated SVGs must not share clipping IDs')
 const hidden = renderToStaticMarkup(h(BadgeCard, { badge: { ...badge, hidden: true, name: 'Secret badge', description: 'Keep learning.' } }))
 assert.ok(!hidden.includes('badge-svg') && !hidden.includes('Advanced') && !hidden.includes('10 /'))
 const legacy = renderToStaticMarkup(h(BadgeArt, { badge: { ...badge, badge_design: null, icon: 'lesson' } }))
 assert.ok(!legacy.includes('badge-svg') && legacy.includes('lucide-book-open'))
 const precision = renderToStaticMarkup(h(BadgeArt, { badge: { ...badge, metric: 'perfect_lessons', icon: 'lesson' } }))
 assert.ok(precision.includes('lucide-target'), 'Metric determines the central SVG icon')
 const designer = renderToStaticMarkup(h(BadgeDesigner, { badge, catalog, onChange() {} }))
 assert.ok(designer.includes('Undo') && designer.includes('Redo') && designer.includes('Shuffle design') && designer.includes('also belongs'))
 const collection = renderToStaticMarkup(h(BadgeCollection, { badges: [badge, { ...badge, id: 'standalone', milestone_group: null, name: 'Challenge' }] }))
 assert.ok(collection.includes('Learning milestones') && collection.includes('Lessons completed'))
 console.log('PASS scalable SVGs, unique clip IDs, fixed category icons, legacy fallback, secret masking and designer controls')
} finally { await vite.close() }
