import { useEffect, useState } from 'react'
import { Search, LayoutGrid, Columns3, List, ArrowLeft, EyeOff } from 'lucide-react'
import { achievementMetrics, BadgeCard, BadgeArt, badgeIcons, statusLabels } from '../components/Achievements'
import { api } from '../auth'

const empty = { name: '', description: '', metric: 'completed_lessons', threshold: 1, icon: 'trophy', status: 'draft', is_secret: false, hint: '' }
const views = [['gallery', 'Gallery', LayoutGrid], ['board', 'Board', Columns3], ['list', 'List', List]]

export default function AdminAchievements() {
 const [badges, setBadges] = useState(null)
 const [selected, setSelected] = useState(null)
 const [form, setForm] = useState(null)
 const [filter, setFilter] = useState('all')
 const [search, setSearch] = useState('')
 const [view, setView] = useState(() => {
  try { return ['gallery', 'board', 'list'].includes(localStorage.getItem('asignx-badge-view')) ? localStorage.getItem('asignx-badge-view') : 'gallery' }
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
 const visible = badges?.filter(b => (filter === 'all' || b.status === filter) &&
  [b.name, b.description, achievementMetrics[b.metric]].join(' ').toLowerCase().includes(search.toLowerCase()))
 function changeView(next) {
  setView(next)
  try { localStorage.setItem('asignx-badge-view', next) } catch { /* Preferences are optional. */ }
 }
 function edit(badge) { setForm({ ...empty, ...badge }); setSelected(null); setPreviewEarned(false); setError(''); setMessage('') }
 const field = (key, value) => setForm(current => ({ ...current, [key]: value }))
 async function save(event) {
  event.preventDefault()
  if (busy) return
  setError(''); setMessage(''); setBusy(true)
  const status = event.nativeEvent.submitter?.value || form.status
  try {
   await api(form.id ? '/admin/achievements/' + form.id : '/admin/achievements', {
    method: form.id ? 'PATCH' : 'POST', body: JSON.stringify({ ...form, status }),
   })
   setForm(null)
   setMessage(status === 'published' ? 'Achievement published. Eligible learners receive it automatically.' : status === 'retired' ? 'Achievement retired.' : 'Changes saved.')
   await load()
  } catch (failure) { setError(failure.message) }
  finally { setBusy(false) }
 }
 function card(badge) {
  return <li key={badge.id}><button className="catalog-card" onClick={() => setSelected(badge)}>
   <BadgeArt badge={badge} /><span className="catalog-title">{badge.name}</span>
   <span>{badge.threshold} {achievementMetrics[badge.metric]?.toLowerCase()}</span>
   <span className="catalog-card-meta"><span className={`badge-status status-${badge.status}`}>{statusLabels[badge.status]}</span>{badge.is_secret && <span><EyeOff size={14} /> Secret</span>}</span>
  </button></li>
 }
 const preview = form && form.is_secret && !previewEarned
  ? { name: 'Secret badge', description: form.hint || 'Keep learning to discover this badge.', hidden: true }
  : { ...form, unlocked_at: previewEarned ? previewDate : null }
 return <section className="admin-authoring studio-section studio-page achievement-page">
  <header className="page-heading"><div><h1>{form ? 'Preview Studio' : selected ? 'Badge Inspector' : 'Achievements'}</h1>
   <p>{form ? 'Design the badge and preview its locked and earned states.' : 'Create milestones for every stage of learning.'}</p></div>
   {!form && <button className="btn" onClick={() => edit(empty)}>New badge</button>}
  </header>
  {error && <p role="alert">{error} {!badges && <button className="text-link" onClick={() => { setError(''); load() }}>Retry</button>}</p>}
  {message && <p role="status">{message}</p>}
  {form ? <div className="badge-editor">
   <form className="studio-progress-panel admin-form" onSubmit={save}>
    <fieldset disabled={busy}><legend>{form.id ? 'Edit badge' : 'Draft details'}</legend>
     <label>Name<input required maxLength={100} value={form.name} onChange={e => field('name', e.target.value)} /></label>
     <label>Description<textarea required maxLength={1000} rows={3} value={form.description} onChange={e => field('description', e.target.value)} /></label>
     <label>Requirement<select disabled={form.requirement_locked} value={form.metric} onChange={e => field('metric', e.target.value)}>
      {Object.entries(achievementMetrics).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
     <label>Target<input type="number" required min={1} max={2147483647} disabled={form.requirement_locked} value={form.threshold} onChange={e => field('threshold', e.target.valueAsNumber || '')} /></label>
     {form.metric === 'perfect_lessons' && <p>Each different lesson counts once. A perfect replay counts toward this goal.</p>}
     {form.metric === 'completed_courses' && <p>A course counts when all of its published lessons are complete.</p>}
     {form.requirement_locked && <p>This badge has been earned. Its requirement is locked.</p>}
     <label>Icon<select value={form.icon} onChange={e => field('icon', e.target.value)}>{Object.keys(badgeIcons).map(icon => <option key={icon} value={icon}>{icon}</option>)}</select></label>
     <label>Visibility<select value={form.is_secret ? 'secret' : 'visible'} onChange={e => field('is_secret', e.target.value === 'secret')}><option value="visible">Visible to learners</option><option value="secret">Secret until earned</option></select></label>
     {form.is_secret && <label>Optional hint<input maxLength={250} value={form.hint} onChange={e => field('hint', e.target.value)} /></label>}
    </fieldset>
    <div className="admin-actions"><button className="btn" disabled={busy}>{busy ? 'Saving…' : form.id ? 'Save changes' : 'Save draft'}</button>
     {form.id && form.status !== 'published' && <button className="btn btn-secondary" value="published" disabled={busy}>Publish</button>}
     {form.status === 'published' && <button className="btn btn-secondary" value="retired" disabled={busy}>Retire</button>}
     <button className="text-link" type="button" disabled={busy} onClick={() => { setForm(null); setError('') }}>Cancel</button></div>
   </form>
   <aside className="studio-progress-panel badge-preview"><h2>Learner preview</h2><div className="badge-filters" aria-label="Preview state">
    {[[false, 'Locked'], [true, 'Earned']].map(([value, label]) => <button key={label} aria-pressed={previewEarned === value} onClick={() => setPreviewEarned(value)}>{label}</button>)}</div>
    <ul className="collection-grid"><BadgeCard badge={preview} preview /></ul>
   </aside>
  </div> : selected ? <>
   <button className="text-link inspector-back" onClick={() => setSelected(null)}><ArrowLeft size={16} /> Back to badges</button>
   <div className="badge-inspector"><nav aria-label="Inspect a badge">{badges.map(b => <button key={b.id} aria-pressed={selected.id === b.id} onClick={() => setSelected(b)}>{b.name}</button>)}</nav>
    <article className="studio-progress-panel inspector-detail"><BadgeArt badge={selected} /><h2>{selected.name}</h2><p>{selected.description}</p>
     <dl><dt>Requirement</dt><dd>{selected.threshold} {achievementMetrics[selected.metric]?.toLowerCase()}</dd><dt>Visibility</dt><dd>{selected.is_secret ? 'Secret until earned' : 'Visible'}</dd>
      {selected.is_secret && <><dt>Hint</dt><dd>{selected.hint || 'No hint'}</dd></>}<dt>Status</dt><dd>{statusLabels[selected.status]}</dd></dl>
     <button className="btn" onClick={() => edit(selected)}>Edit badge</button></article>
   </div>
  </> : badges ? <>
   <div className="badge-toolbar"><div className="badge-view-switch" aria-label="Catalog view">{views.map(([key, label, Icon]) => <button key={key} aria-pressed={view === key} onClick={() => changeView(key)}><Icon size={16} />{label}</button>)}</div>
    <label className="badge-search"><Search size={17} /><span className="sr-only">Search badges</span><input aria-label="Search badges" placeholder="Search badges" value={search} onChange={e => setSearch(e.target.value)} /></label>
    <select aria-label="Filter badge status" value={filter} onChange={e => setFilter(e.target.value)}>{Object.entries({ all: 'All statuses', ...statusLabels }).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
   </div>
   <p className="catalog-count">{visible.length} {visible.length === 1 ? 'badge' : 'badges'}</p>
   {view === 'board' ? <div className="publishing-board">{Object.entries(statusLabels).map(([status, label]) => {
    const lane = visible.filter(b => b.status === status)
    return <section key={status}><h2>{label} <span>{lane.length}</span></h2>{lane.length ? <ul className="catalog-grid">{lane.map(card)}</ul> : <p>No {label.toLowerCase()} badges.</p>}</section>
   })}</div> : view === 'gallery' ? visible.length ? <ul className="catalog-grid">{visible.map(card)}</ul> : <p>No badges match your search.</p> :
    <ul className="badge-list catalog-list">{visible.map(b => <li key={b.id}><button onClick={() => setSelected(b)}><BadgeArt badge={b} /><span><strong>{b.name}</strong><small>{b.threshold} {achievementMetrics[b.metric]?.toLowerCase()}</small></span><span>{b.is_secret ? 'Secret' : 'Visible'}</span><span className={`badge-status status-${b.status}`}>{statusLabels[b.status]}</span></button></li>)}</ul>}
  </> : !error && <p role="status">Loading achievements…</p>}
 </section>
}
