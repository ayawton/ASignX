import { useEffect, useState } from 'react'
import { Search, LayoutGrid, List, ArrowLeft, EyeOff, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { achievementMetrics, BadgeCard, BadgeArt, statusLabels } from '../components/Achievements'
import BadgeDesigner from '../components/BadgeDesigner'
import { badgeCategories, badgeTiers, defaultBadgeDesign } from '../data/badge-design'
import { api } from '../auth'

const empty = { name: '', description: '', metric: 'completed_lessons', threshold: 1, icon: 'lesson', status: 'draft', is_secret: false, hint: '', tier: 'starter', milestone_group: null, badge_design: defaultBadgeDesign }
const views = [['gallery', 'Gallery', LayoutGrid], ['list', 'List', List]]
const pageSize = 12

export default function AdminAchievements() {
 const [badges, setBadges] = useState(null)
 const [selected, setSelected] = useState(null)
 const [form, setForm] = useState(null)
 const [editorTab, setEditorTab] = useState('details')
 const [filter, setFilter] = useState('all')
 const [search, setSearch] = useState('')
 const [page, setPage] = useState(1)
 const [view, setView] = useState(() => {
  try { return localStorage.getItem('asignx-badge-view') === 'list' ? 'list' : 'gallery' }
  catch { return 'gallery' }
 })
 const [previewEarned, setPreviewEarned] = useState(false)
 const [previewDate] = useState(() => new Date().toISOString())
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState('')
 const [message, setMessage] = useState('')
 async function load() {
  try { setBadges(await api('/admin/achievements')) }
  catch (failure) { setError(failure.message) }
 }
 useEffect(() => { load() }, [])
 const visible = (badges ?? []).filter(b => (filter === 'all' || b.status === filter) &&
  [b.name, b.description, achievementMetrics[b.metric], badgeTiers[b.tier || 'starter'], b.milestone_group].join(' ').toLowerCase().includes(search.trim().toLowerCase()))
 const pageCount = Math.max(1, Math.ceil(visible.length / pageSize))
 const currentPage = Math.min(page, pageCount)
 const start = (currentPage - 1) * pageSize
 const pageBadges = visible.slice(start, start + pageSize)
 function changeView(next) {
  setView(next)
  try { localStorage.setItem('asignx-badge-view', next) } catch { /* Preferences are optional. */ }
 }
 function edit(badge) { setForm({ ...empty, ...badge }); setSelected(null); setEditorTab('details'); setPreviewEarned(false); setError(''); setMessage('') }
 const field = (key, value) => setForm(current => ({ ...current, [key]: value }))
 async function save(event) {
  event.preventDefault()
  if (busy) return
  if (!form.name.trim() || !form.description.trim() || !Number.isInteger(form.threshold) || form.threshold < 1 || form.threshold > 2147483647 || (form.milestone_group !== null && !form.milestone_group.trim())) {
   setError('Enter a name, description, positive whole-number target, and a group name for milestone badges.'); setEditorTab('details'); return
  }
  setError(''); setMessage(''); setBusy(true)
  const status = event.nativeEvent.submitter?.value || form.status
  try {
   await api(form.id ? '/admin/achievements/' + form.id : '/admin/achievements', {
    method: form.id ? 'PATCH' : 'POST', body: JSON.stringify({ ...form, status }),
   })
   setForm(null)
   setPage(1)
   setMessage(status === 'published' ? 'Achievement published. Eligible learners receive it automatically.' : status === 'retired' ? 'Achievement retired.' : 'Changes saved.')
   await load()
  } catch (failure) { setError(failure.message) }
  finally { setBusy(false) }
 }
 function card(badge) {
  return <li key={badge.id}><button className="catalog-card" onClick={() => setSelected(badge)}>
   <BadgeArt badge={badge} /><span className="catalog-title">{badge.name}</span>
   <span className="catalog-requirement">{badge.threshold} {achievementMetrics[badge.metric]?.toLowerCase()}</span><span className="badge-tier">{badgeTiers[badge.tier || 'starter']}</span>
   <span className="catalog-card-meta"><span className={`badge-status status-${badge.status}`}>{statusLabels[badge.status]}</span>{badge.is_secret && <span><EyeOff size={14} /> Secret</span>}</span>
  </button></li>
 }
 const preview = form && form.is_secret && !previewEarned
  ? { name: 'Secret badge', description: form.hint || 'Keep learning to discover this badge.', hidden: true }
  : { ...form, unlocked_at: previewEarned ? previewDate : null }
 return <section className="admin-authoring studio-section studio-page achievement-page">
  <header className="page-heading"><div><h1>{form ? 'Preview Studio' : selected ? 'Badge Inspector' : 'Achievements'}</h1>
   <p>{form ? 'Design the badge and preview its locked and earned states.' : 'Create milestones for every stage of learning.'}</p></div>
   {!form && <button className="btn" onClick={() => edit(empty)}><Plus size={17} aria-hidden="true" />New badge</button>}
  </header>
  {error && <p className="badge-feedback is-error" role="alert">{error} {!badges && <button className="text-link" onClick={() => { setError(''); load() }}>Retry</button>}</p>}
  {message && <p className="badge-feedback" role="status">{message}</p>}
  {form ? <div className="badge-editor">
   <form className="studio-progress-panel admin-form" onSubmit={save} noValidate>
    <div className="badge-editor-tabs" role="tablist" aria-label="Badge authoring" onKeyDown={event => {
     if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
     event.preventDefault()
     const next = event.key === 'Home' ? 'details' : event.key === 'End' ? 'designer' : editorTab === 'details' ? 'designer' : 'details'
     setEditorTab(next); document.getElementById(`badge-tab-${next}`)?.focus()
    }}>{[['details', 'Details'], ['designer', 'Designer']].map(([key, label]) => <button key={key} id={`badge-tab-${key}`} type="button" role="tab" tabIndex={editorTab === key ? 0 : -1} aria-selected={editorTab === key} aria-controls={`badge-panel-${key}`} onClick={() => setEditorTab(key)}>{label}</button>)}</div>
    <div id="badge-panel-details" role="tabpanel" aria-labelledby="badge-tab-details" hidden={editorTab !== 'details'}>
    <fieldset disabled={busy}><legend>{form.id ? 'Edit badge' : 'Draft details'}</legend>
     <label>Name<input required maxLength={100} value={form.name} onChange={e => field('name', e.target.value)} /></label>
     <label>Description<textarea required maxLength={1000} rows={3} value={form.description} onChange={e => field('description', e.target.value)} /></label>
     <label>Requirement<select disabled={form.requirement_locked} value={form.metric} onChange={e => field('metric', e.target.value)}>
      {Object.entries(achievementMetrics).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
     <label>Target<input type="number" required min={1} max={2147483647} disabled={form.requirement_locked} value={form.threshold} onChange={e => field('threshold', e.target.valueAsNumber || '')} /></label>
     {form.metric === 'perfect_lessons' && <p>Each different lesson counts once. A perfect replay counts toward this goal.</p>}
     {form.metric === 'completed_courses' && <p>A course counts when all of its published lessons are complete.</p>}
     {form.requirement_locked && <p>This badge has been earned. Its requirement is locked.</p>}
     <label>Achievement structure<select value={form.milestone_group === null ? 'standalone' : 'milestone'} onChange={e => field('milestone_group', e.target.value === 'standalone' ? null : '')}><option value="standalone">Standalone challenge</option><option value="milestone">Milestone series</option></select></label>
     {form.milestone_group !== null && <label>Milestone group<input required maxLength={80} list="badge-milestone-groups" value={form.milestone_group} onChange={e => field('milestone_group', e.target.value)} /><datalist id="badge-milestone-groups">{[...new Set((badges || []).filter(b => b.metric === form.metric && b.milestone_group).map(b => b.milestone_group))].map(group => <option key={group} value={group} />)}</datalist></label>}
     <label>Visibility<select value={form.is_secret ? 'secret' : 'visible'} onChange={e => field('is_secret', e.target.value === 'secret')}><option value="visible">Visible to learners</option><option value="secret">Secret until earned</option></select></label>
     {form.is_secret && <label>Optional hint<input maxLength={250} value={form.hint} onChange={e => field('hint', e.target.value)} /></label>}
    </fieldset>
    </div>
    <div id="badge-panel-designer" role="tabpanel" aria-labelledby="badge-tab-designer" hidden={editorTab !== 'designer'}>
     <BadgeDesigner key={form.id || 'new'} badge={form} catalog={badges || []} disabled={busy} onChange={design => setForm(current => ({ ...current, ...design }))} />
    </div>
    <div className="admin-actions"><button className="btn" disabled={busy}>{busy ? 'Saving…' : form.id ? 'Save changes' : 'Save draft'}</button>
     {form.id && form.status !== 'published' && <button className="btn btn-secondary" value="published" disabled={busy}>Publish</button>}
     {form.status === 'published' && <button className="btn btn-secondary" value="retired" disabled={busy}>Retire</button>}
     <button className="text-link" type="button" disabled={busy} onClick={() => { setForm(null); setError('') }}>Cancel</button></div>
   </form>
   <aside className="studio-progress-panel badge-preview"><h2>Learner preview</h2><div className="badge-filters" aria-label="Preview state">
    {[[false, 'Locked'], [true, 'Earned']].map(([value, label]) => <button key={label} aria-pressed={previewEarned === value} onClick={() => setPreviewEarned(value)}>{label}</button>)}</div>
    <ul className="collection-grid"><BadgeCard badge={preview} preview /></ul>
    <div className="badge-size-preview"><h3>Artwork at every size</h3><div>{[[32, 'Small'], [64, 'Medium'], [112, 'Large']].map(([size, label]) => <figure key={size}><div style={{ width: size, height: size * 1.125 }}><BadgeArt badge={form} /></div><figcaption>{label}</figcaption></figure>)}</div><p>{badgeCategories[form.metric].label} · {badgeTiers[form.tier]} · SVG artwork</p></div>
   </aside>
  </div> : selected ? <>
   <button className="text-link inspector-back" onClick={() => setSelected(null)}><ArrowLeft size={16} /> Back to badges</button>
   <div className="badge-inspector"><nav aria-label="Inspect a badge">{badges.map(b => <button key={b.id} aria-pressed={selected.id === b.id} onClick={() => setSelected(b)}>{b.name}</button>)}</nav>
    <article className="studio-progress-panel inspector-detail"><BadgeArt badge={selected} /><h2>{selected.name}</h2><p>{selected.description}</p>
     <dl><dt>Requirement</dt><dd>{selected.threshold} {achievementMetrics[selected.metric]?.toLowerCase()}</dd><dt>Tier</dt><dd>{badgeTiers[selected.tier || 'starter']}</dd><dt>Structure</dt><dd>{selected.milestone_group || 'Standalone challenge'}</dd><dt>Visibility</dt><dd>{selected.is_secret ? 'Secret until earned' : 'Visible'}</dd>
      {selected.is_secret && <><dt>Hint</dt><dd>{selected.hint || 'No hint'}</dd></>}<dt>Status</dt><dd>{statusLabels[selected.status]}</dd></dl>
     <button className="btn" onClick={() => edit(selected)}>Edit badge</button></article>
   </div>
  </> : badges ? <>
   <div className="badge-toolbar">
    <div className="badge-search"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Search badges" placeholder="Search badges" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} /></div>
    <select aria-label="Filter badge status" value={filter} onChange={e => { setFilter(e.target.value); setPage(1) }}>{Object.entries({ all: 'All statuses', ...statusLabels }).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
    <div className="badge-view-switch" role="group" aria-label="Catalog view">{views.map(([key, label, Icon]) => <button key={key} aria-pressed={view === key} onClick={() => changeView(key)}><Icon size={16} aria-hidden="true" />{label}</button>)}</div>
   </div>
   {!visible.length ? <p className="badge-empty" role="status">{badges.length ? 'No badges match your search or status filter.' : 'No badges yet. Create a new badge to get started.'}</p> : <>
    {view === 'gallery' ? <ul className="catalog-grid">{pageBadges.map(card)}</ul> :
     <ul className="badge-list catalog-list">{pageBadges.map(b => <li key={b.id}><button onClick={() => setSelected(b)}><BadgeArt badge={b} /><span><strong>{b.name}</strong><small>{b.threshold} {achievementMetrics[b.metric]?.toLowerCase()} · {badgeTiers[b.tier || 'starter']}</small></span><span>{b.is_secret ? 'Secret' : 'Visible'}</span><span className={`badge-status status-${b.status}`}>{statusLabels[b.status]}</span></button></li>)}</ul>}
    <footer className="badge-pagination">
     <p className="catalog-count" role="status">{start + 1}–{Math.min(start + pageSize, visible.length)} of {visible.length} {visible.length === 1 ? 'badge' : 'badges'}</p>
     <nav aria-label="Badge pages">
      <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} aria-hidden="true" />Previous</button>
      <span>Page {currentPage} of {pageCount}</span>
      <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next<ChevronRight size={16} aria-hidden="true" /></button>
     </nav>
    </footer>
   </>}
  </> : !error && <p role="status">Loading achievements…</p>}
 </section>
}
