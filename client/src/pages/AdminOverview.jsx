import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, BookOpen } from 'lucide-react'
import { api, useAuth } from '../auth'
import './Admin.css'

export default function AdminOverview() {
 const { user } = useAuth()
 return <Overview key={user?.id} />
}
function Overview() {
 const [data, setData] = useState(null), [error, setError] = useState(''), [revision, setRevision] = useState(0)
 useEffect(() => {
  let active = true
  api('/admin/overview').then(value => { if (active) { setData(value); setError('') } }).catch(e => { if (active) setError(e.message) })
  return () => { active = false }
 }, [revision])
 return <section className="admin-overview studio-section studio-page">
  <header className="page-heading"><div><h1>System overview</h1><p>Your learning content and account activity at a glance.</p></div><Link className="btn" to="/dashboard/admin/courses">Manage courses <ArrowUpRight size={17} /></Link></header>
  {error ? <div className="admin-notice" role="alert"><p>{error}</p><button className="btn btn-secondary" onClick={() => { setError(''); setRevision(v => v+1) }}>Try again</button></div> : !data ? <p role="status">Loading system overview…</p> : <>
   <dl className="admin-metrics">{[['Learner accounts',data.learners],['Published courses',data.published_courses],['Draft courses',data.courses-data.published_courses],['Total lessons',data.lessons],['Enrollments',data.enrollments],['Completed lessons',data.completed_lessons]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
   <article className="studio-progress-panel"><div className="admin-panel-heading"><h2>Recently created courses</h2><Link className="text-link" to="/dashboard/admin/courses">View all courses</Link></div>
    {data.recent_courses.length ? <ul className="admin-recent-courses">{data.recent_courses.map(course => <li key={course.id}><span className="learner-course-icon"><BookOpen size={22} /></span><div><h3><Link to={`/dashboard/admin/courses/${course.id}`}>{course.title}</Link></h3><p>{course.is_published ? 'Published' : 'Draft'} · Created {new Date(course.created_at).toLocaleDateString()}</p></div><Link className="btn btn-secondary" to={`/dashboard/admin/courses/${course.id}`}>{course.is_published ? 'View content' : 'Manage content'}</Link></li>)}</ul> : <p>No courses yet. Open Manage courses to create your first draft.</p>}
   </article><p className="admin-data-note">Account activity counts saved learning records. Guest practice and transient camera sessions are excluded.</p>
  </>}
 </section>
}
