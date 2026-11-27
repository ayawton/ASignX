import { useState } from 'react'
import { Shuffle, RotateCcw, Undo2, Redo2 } from 'lucide-react'
import { badgeCategories, badgeShapes, badgeTiers, defaultBadgeDesign, designOptions, designSignature, normalizeBadgeDesign, suggestedBadgeTier, unusedBadgeDesign } from '../data/badge-design'

export default function BadgeDesigner({ badge, catalog, onChange, disabled }) {
 const [past, setPast] = useState([]), [future, setFuture] = useState([])
 const [notice, setNotice] = useState('')
 const category = badgeCategories[badge.metric]
 const snapshot = { tier: badge.tier || 'starter', badge_design: badge.badge_design }
 function apply(next) {
  setPast(items => [...items.slice(-29), snapshot]); setFuture([]); setNotice(''); onChange(next)
 }
 function shuffle() {
  const next = unusedBadgeDesign(badge, catalog)
  if (next) apply({ ...snapshot, badge_design: next })
  else setNotice('Every combination for this category and tier is already in use. Choose another tier or edit a design.')
 }
 const recipe = normalizeBadgeDesign(badge.badge_design)
 const duplicate = badge.badge_design && catalog.find(b => b.id !== badge.id && designSignature(b) === designSignature(badge))
 const suggested = suggestedBadgeTier(badge, catalog)
 return <fieldset disabled={disabled} className="badge-designer">
  <legend>Badge designer</legend>
  <p className="badge-design-identity"><strong>{category.label}</strong><span>{category.icon} icon · coordinated category colors</span></p>
  <label>Milestone tier<select value={snapshot.tier} onChange={e => apply({ ...snapshot, tier: e.target.value })}>
   {Object.entries(badgeTiers).map(([key, label]) => <option key={key} value={key}>{label} — {badgeShapes[key]}</option>)}
  </select></label>
  <p className="badge-design-help">Tier describes difficulty, not how many people have earned the badge. Standalone challenges can use any tier.</p>
  {suggested && <div className="badge-tier-suggestion"><span>Suggested from milestone order: {badgeTiers[suggested]}</span>
   <button type="button" className="text-link" disabled={suggested === snapshot.tier} onClick={() => apply({ ...snapshot, tier: suggested })}>Use suggestion</button></div>}
  {!badge.badge_design ? <div className="badge-empty"><p>This badge uses temporary artwork.</p><button type="button" className="text-link" onClick={() => apply({ ...snapshot, badge_design: { ...defaultBadgeDesign } })}>Start designing</button></div> : <>
   <div className="badge-design-fields">{Object.entries(designOptions).map(([key, choices]) => <label key={key}>{key === 'finish' ? 'Color depth' : key[0].toUpperCase() + key.slice(1)}
    <select value={recipe[key]} onChange={e => apply({ ...snapshot, badge_design: { ...recipe, [key]: e.target.value } })}>
     {choices.map(choice => <option key={choice} value={choice}>{choice[0].toUpperCase() + choice.slice(1)}</option>)}
    </select></label>)}</div>
   <div className="badge-design-tools"><button type="button" onClick={shuffle}><Shuffle size={16} />Shuffle design</button>
    <button type="button" onClick={() => apply({ ...snapshot, badge_design: { ...defaultBadgeDesign } })}><RotateCcw size={16} />Reset</button></div>
  </>}
  <div className="badge-design-tools"><button type="button" disabled={!past.length} onClick={() => {
   onChange(past.at(-1)); setPast(past.slice(0, -1)); setFuture([snapshot, ...future]); setNotice('')
  }}><Undo2 size={16} />Undo</button><button type="button" disabled={!future.length} onClick={() => {
   onChange(future[0]); setFuture(future.slice(1)); setPast([...past, snapshot]); setNotice('')
  }}><Redo2 size={16} />Redo</button></div>
  {duplicate && <p className="badge-design-warning" role="status">This design also belongs to “{duplicate.name}”. Shuffle to find an unused combination.</p>}
  {notice && <p role="status" className="badge-design-warning">{notice}</p>}
 </fieldset>
}
