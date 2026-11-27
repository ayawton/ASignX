import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { badgeCategories } from '../data/badge-design'

function TypeGroup({ metric, badges, renderCard }) {
 const [page, setPage] = useState(1)
 const pages = Math.max(1, Math.ceil(badges.length / 12)), current = Math.min(page, pages)
 const start = (current - 1) * 12
 return <section className="badge-type-group"><header><h2>{badgeCategories[metric].label}</h2><span>{badges.length} {badges.length === 1 ? 'badge' : 'badges'}</span></header>
  <ul className="catalog-grid">{badges.slice(start, start + 12).map(renderCard)}</ul>
  <footer className="badge-pagination"><p className="catalog-count" role="status">{start + 1}–{Math.min(start + 12, badges.length)} of {badges.length}</p>
   <nav aria-label={`${badgeCategories[metric].label} badge pages`}><button type="button" disabled={current === 1} onClick={() => setPage(current - 1)}><ChevronLeft size={16} />Previous</button><span>Page {current} of {pages}</span><button type="button" disabled={current === pages} onClick={() => setPage(current + 1)}>Next<ChevronRight size={16} /></button></nav></footer>
 </section>
}
export default function BadgeTypeGroups({ badges, renderCard }) {
 return <div className="badge-type-groups">{Object.keys(badgeCategories).map(metric => {
  const group = badges.filter(b => b.metric === metric)
  return group.length ? <TypeGroup key={metric} metric={metric} badges={group} renderCard={renderCard} /> : null
 })}</div>
}
