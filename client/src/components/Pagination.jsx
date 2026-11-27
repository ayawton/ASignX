import { ChevronLeft, ChevronRight } from 'lucide-react'
import { pageNumbers } from '../data/pagination'

export default function Pagination({ current, total, onChange, label = 'Pages' }) {
 return <nav className="numbered-pagination" aria-label={label}>
  <button type="button" aria-label="Previous page" title="Previous page" disabled={current === 1} onClick={() => onChange(current - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
  {[1, 0].map(neighbors => <span key={neighbors} className={neighbors ? 'pagination-wide' : 'pagination-compact'}>{pageNumbers(current, total, neighbors).map(page => typeof page === 'number' ?
   <button type="button" key={page} aria-label={`Page ${page}`} aria-current={page === current ? 'page' : undefined} onClick={() => onChange(page)}>{page}</button> :
   <span className="pagination-gap" key={page} aria-hidden="true">…</span>)}</span>)}
  <button type="button" aria-label="Next page" title="Next page" disabled={current === total} onClick={() => onChange(current + 1)}><ChevronRight size={18} aria-hidden="true" /></button>
 </nav>
}
