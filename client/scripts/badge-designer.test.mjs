import assert from 'node:assert/strict'
import { filterBadges, badgeFieldErrors } from '../src/data/badge-catalog.js'
import { normalizeBadgeDesign } from '../src/data/badge-design.js'
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
for (let i = 0; i < 127; i++) {
 const recipe = unusedBadgeDesign(badge, [...catalog, ...generated], () => 0)
 assert.ok(recipe, 'An unused recipe should be available')
 const next = { ...badge, id: `new-${i}`, badge_design: recipe }
 assert.notEqual(designSignature(next), designSignature(badge))
 assert.ok(!generated.some(item => designSignature(item) === designSignature(next)))
 generated.push(next)
}
assert.equal(unusedBadgeDesign(badge, [...catalog, ...generated]), null, 'Exhaustion stops without an infinite shuffle loop')
assert.equal(normalizeBadgeDesign({...defaultBadgeDesign,finish:'soft'}).finish,'classic')
assert.deepEqual(designOptions.finish,['classic','deep'])
const samples=[{...badge,id:'a',status:'draft',is_secret:false},{...badge,id:'b',metric:'total_xp',threshold:100,tier:'mastery',status:'published',is_secret:true}]
assert.equal(filterBadges(samples,{type:'total_xp',visibility:'secret',status:'published'})[0].id,'b')
assert.equal(filterBadges(samples,{search:'Learning'}).length,2)
assert.equal(filterBadges(samples,{sort:'target'})[0].id,'a')
assert.equal(filterBadges(samples,{sort:'tier'})[1].id,'b')
assert.deepEqual(Object.keys(badgeFieldErrors({...badge,name:' ',description:'',threshold:0,milestone_group:''})),['name','description','threshold','milestone_group'])
assert.deepEqual(badgeFieldErrors({...badge,milestone_group:null}),{})
console.log('PASS filters, sorting, required fields and legacy Soft compatibility')
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
 assert.ok(!designer.includes('<select'))
 assert.ok(!designer.includes('>Soft<'))
 assert.ok(designer.includes('aria-pressed="true"'))
 assert.ok(designer.includes('Undo') && designer.includes('Redo') && designer.includes('Shuffle design') && designer.includes('also belongs'))
 const {default: BadgeTypeGroups}=await vite.ssrLoadModule('/src/components/BadgeTypeGroups.jsx')
 const grouped=renderToStaticMarkup(h(BadgeTypeGroups,{badges:Array.from({length:13},(_,i)=>({...badge,id:String(i)})),renderCard:b=>h('li',{key:b.id},b.name)}))
 assert.ok(grouped.includes('aria-current="page"') && grouped.includes('aria-label="Page 2"'))
 assert.equal((grouped.match(/<li/g)||[]).length,12)
 const ordered = renderToStaticMarkup(h(BadgeTypeGroups, { badges: [
  {...badge,id:'high',name:'Zeta',threshold:100}, {...badge,id:'low-b',name:'Beta',threshold:2}, {...badge,id:'low-a',name:'Alpha',threshold:2}
 ], renderCard: b => h('li',{key:b.id},b.name) }))
 assert.ok(ordered.indexOf('Alpha') < ordered.indexOf('Beta') && ordered.indexOf('Beta') < ordered.indexOf('Zeta'))
 const collection = renderToStaticMarkup(h(BadgeCollection, { badges: [badge, { ...badge, id: 'standalone', milestone_group: null, name: 'Challenge' }] }))
 assert.ok(collection.includes('Learning milestones') && collection.includes('Lessons completed'))
 console.log('PASS scalable SVGs, unique clip IDs, fixed category icons, legacy fallback, secret masking and designer controls')
} finally { await vite.close() }
