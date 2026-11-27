import { useEffect, useState } from 'react'
import { achievementMetrics, BadgeCard, badgeIcons } from '../components/Achievements'
import { api } from '../auth'

const empty = { name: '', description: '', metric: 'completed_lessons', threshold: 1, icon: 'trophy', status: 'draft' }
const statusLabels = { draft: 'Draft', published: 'Published', retired: 'Retired' }

export default function AdminAchievements() {
 const [badges, setBadges] = useState(null)
 const [form, setForm] = useState(null)
 const [filter, setFilter] = useState('all')
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState('')
 const [message, setMessage] = useState('')
 async function load() {
  try { setBadges(await api('/admin/achievements')) }
  catch (failure) { setError(failure.message) }
 }
 useEffect(() => { load() }, [])
 const visible = badges?.filter(badge => filter === 'all' || badge.status === filter)
 const field = (key, value) => setForm(current => ({ ...current, [key]: value }))
 async function save(event) {
  event.preventDefault()
  setError('')
  setMessage('')
  setBusy(true)
  const status = event.nativeEvent.submitter?.value || form.status
  try {
   await api(form.id ? '/admin/achievements/' + form.id : '/admin/achievements', {
    method: form.id ? 'PATCH' : 'POST', body: JSON.stringify({ ...form, status }),
   })
   setForm(null)
   setMessage(status === 'published' ? 'Achievement published.' : status === 'retired' ? 'Achievement retired.' : 'Draft saved.')
   await load()
  } catch (failure) { setError(failure.message) }
  finally { setBusy(false) }
 }
 return <section className="admin-authoring studio-section studio-page achievement-page">
  <header className="page-heading"><h1>Achievements</h1>
   {!form && <button className="btn" onClick={() => { setForm(empty); setMessage(''); setError('') }}>New badge</button>}
  </header>
  {error && <p role="alert">{error} {!badges && <button className="text-link" onClick={() => { setError(''); load() }}>Retry</button>}</p>}
  {message && <p role="status">{message}</p>}
  {form ? <div className="badge-editor">
   <form className="studio-progress-panel admin-form" onSubmit={save}>
    <fieldset disabled={busy}>
     <legend>{form.id ? 'Edit badge' : 'Draft details'}</legend>
     <label>Name<input required maxLength={100} value={form.name} onChange={e => field('name', e.target.value)} /></label>
     <label>Description<textarea required maxLength={1000} rows={3} value={form.description} onChange={e => field('description', e.target.value)} /></label>
     <label>Metric<select disabled={form.requirement_locked} value={form.metric} onChange={e => field('metric', e.target.value)}>
      {Object.entries(achievementMetrics).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
     </select></label>
     <label>Target<input type="number" required min={1} max={2147483647} disabled={form.requirement_locked} value={form.threshold} onChange={e => field('threshold', e.target.valueAsNumber || '')} /></label>
     {form.requirement_locked && <p>Learners have earned this badge. Its requirement is locked.</p>}
     <label>Icon<select value={form.icon} onChange={e => field('icon', e.target.value)}>
      {Object.keys(badgeIcons).map(icon => <option key={icon} value={icon}>{icon}</option>)}
     </select></label>
    </fieldset>
    <div className="admin-actions">
     <button className="btn" disabled={busy}>{form.id ? 'Save changes' : 'Save draft'}</button>
     {form.id && form.status !== 'published' && <button className="btn btn-secondary" value="published" disabled={busy}>Publish</button>}
     {form.status === 'published' && <button className="btn btn-secondary" value="retired" disabled={busy}>Retire</button>}
     <button className="text-link" type="button" disabled={busy} onClick={() => { setForm(null); setError('') }}>Cancel</button>
    </div>
   </form>
   <aside className="studio-progress-panel"><h2>Learner preview</h2><ul className="badge-list"><BadgeCard badge={form} preview /></ul></aside>
  </div> : badges ? <section className="studio-progress-panel">
   <div className="badge-filters" aria-label="Filter by badge status">
    {Object.entries({ all: 'All badges', ...statusLabels }).map(([key, label]) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}
   </div>
   {visible.length ? <ul className="badge-list">{visible.map(badge => <li key={badge.id} className="admin-badge-row">
    <div><h3>{badge.name}</h3><p>{badge.threshold} · {achievementMetrics[badge.metric]}</p></div>
    <span>{statusLabels[badge.status]}</span>
    <button className="text-link" type="button" aria-label={'Edit ' + badge.name} onClick={() => { setForm(badge); setMessage('') }}>Edit</button>
   </li>)}</ul> : <p>No badges in this view.</p>}
  </section> : !error && <p role="status">Loading achievements…</p>}
 </section>
}
