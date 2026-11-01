import { useEffect, useState } from 'react'
import { api, useAuth } from '../auth'
import { Link } from 'react-router-dom'
import './Admin.css'

export default function Admin() {
 const { user } = useAuth()
 return <AdminCourses key={user?.id} />
}
function AdminCourses() {
 const [courses, setCourses] = useState(null)
 const [error, setError] = useState('')
 const [message, setMessage] = useState('')
 const [busy, setBusy] = useState(false)
 const [attempt, setAttempt] = useState(0)
 const [editing, setEditing] = useState(null)
 const [title, setTitle] = useState('')
 const [description, setDescription] = useState('')
 useEffect(() => {
  let active = true
  api('/admin/courses').then(rows => { if (active) { setCourses(rows); setError('') } }).catch(error => { if (active) { setCourses(null); setError(error.message) } })
  return () => { active = false }
 }, [attempt])
 function edit(course) { setEditing(course.id); setTitle(course.title); setDescription(course.description || ''); setMessage('') }
 function reset() { setEditing(null); setTitle(''); setDescription('') }
 async function save(event) {
  event.preventDefault()
  if (busy) return
  setBusy(true); setMessage('')
  try {
   const saved = await api(editing ? `/admin/courses/${editing}` : '/admin/courses', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify({ title, description }) })
   setCourses(rows => editing ? rows.map(row => row.id === saved.id ? saved : row) : [saved, ...rows])
   reset(); setMessage('Draft saved. It is not visible to learners.')
  } catch (error) { setMessage(error.message) }
  finally { setBusy(false) }
 }
 return <section className="admin-course-list studio-section studio-page"><div className="page-heading"><div><span className="text-label">Administration</span><h1>Manage courses</h1><p>Create drafts, organize lessons, and publish courses for your learners.</p></div></div>
  {error ? <div role="alert"><p>{error}</p><button className="btn" type="button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Try again</button></div> : !courses ? <p role="status">Checking administrator access…</p> : <>
   <article className="studio-progress-panel"><h2>{editing ? 'Edit draft' : 'Create a draft course'}</h2><form onSubmit={save} className="admin-form">
    <label>Course title<input required maxLength={150} value={title} onChange={event => setTitle(event.target.value)} disabled={busy} /></label>
    <label>Description<textarea maxLength={5000} rows={4} value={description} onChange={event => setDescription(event.target.value)} disabled={busy} /></label>
    <div className="admin-actions"><button className="btn" disabled={busy || !title.trim()}>{busy ? 'Saving…' : 'Save draft'}</button>
    {editing && <button className="btn btn-secondary" type="button" disabled={busy} onClick={reset}>Cancel editing</button>}</div>
   </form></article>
   {message && <p role="status">{message}</p>}
   <article className="studio-progress-panel"><h2>All courses</h2>{courses.length ? courses.map(course => <section key={course.id}><h3><Link to={`/dashboard/admin/courses/${course.id}`}>{course.title}</Link></h3><p>{course.description}</p><p>{course.is_published ? 'Published · Read only' : course.is_archived ? 'Archived · Read only' : 'Draft'}</p><div className="admin-actions"><Link className="btn btn-secondary" to={`/dashboard/admin/courses/${course.id}`}>{(course.is_published || course.is_archived) ? 'View content' : 'Manage content'}</Link>{!course.is_published && !course.is_archived && <button className="text-link" type="button" disabled={busy} onClick={() => edit(course)}>Edit course details</button>}</div></section>) : <p>No courses yet. Create your first draft above.</p>}</article>
  </>}
 </section>
}
