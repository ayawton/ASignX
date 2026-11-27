import { useState } from 'react'
import Pagination from './Pagination'
import { filterBadges } from '../data/badge-catalog'
import { badgeCategories } from '../data/badge-design'

function TypeGroup({ metric, badges, renderCard }) {
 const [page, setPage] = useState(1)
 const pages = Math.max(1, Math.ceil(badges.length / 12)), current = Math.min(page, pages)
 const start = (current - 1) * 12
 return <section className="badge-type-group"><header><h2>{badgeCategories[metric].label}</h2><span>{badges.length} {badges.length === 1 ? 'badge' : 'badges'}</span></header>
  <ul className="catalog-grid">{badges.slice(start, start + 12).map(renderCard)}</ul>
  <footer className="badge-pagination"><p className="catalog-count" role="status">{start + 1}–{Math.min(start + 12, badges.length)} of {badges.length}</p>
   <Pagination label={`${badgeCategories[metric].label} badge pages`} current={current} total={pages} onChange={setPage} /></footer>
 </section>
}
export default function BadgeTypeGroups({ badges, renderCard }) {
 return <div className="badge-type-groups">{Object.keys(badgeCategories).map(metric => {
  const group = filterBadges(badges, { type: metric, sort: 'target' })
  return group.length ? <TypeGroup key={metric} metric={metric} badges={group} renderCard={renderCard} /> : null
 })}</div>
}
