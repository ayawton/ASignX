import { useEffect, useState } from 'react'
import Link from './components/WorkspaceLink'
import CourseCard from './components/CourseCard'
import { api, useAuth } from './auth'
export default function PublishedCourses() {
 const { user } = useAuth()
 const userId = user?.id
 const [courses, setCourses] = useState(null), [enrollments, setEnrollments] = useState([])
 const [error, setError] = useState(''), [busy, setBusy] = useState(''), [query, setQuery] = useState(''), [retry, setRetry] = useState(0)
 useEffect(() => {
  let active = true
  Promise.all([api('/courses'), userId ? api('/me/enrollments') : Promise.resolve([])])
   .then(([rows, saved]) => { if (active) { setCourses(rows); setEnrollments(saved) } })
   .catch(e => { if (active) setError(e.message || 'Courses are unavailable right now.') })
  return () => { active = false }
 }, [userId, retry])
 async function enroll(id) {
  setBusy(id); setError('')
  try { const saved = await api('/me/enrollments', { method: 'POST', body: JSON.stringify({ course_id: id }) }); setEnrollments(previous => [...previous.filter(row => row.course_id !== id), saved]) }
  catch (e) { setError(e.message) } finally { setBusy('') }
 }
 const enrolledIds = new Set(enrollments.map(row => row.course_id))
 const filtered = courses?.filter(course => `${course.title} ${course.description || ''}`.toLowerCase().includes(query.toLowerCase()))
 return <section className="published-catalog" aria-labelledby="published-courses-title">
  <div className="section-title"><h2 id="published-courses-title">Explore full courses</h2></div>
  {!user && <p>Browse course descriptions here. Create an account to enroll and save your learning progress.</p>}
  {error && <div role="alert"><p>{error}</p><button className="btn btn-secondary" onClick={() => { setCourses(null); setError(''); setRetry(value => value + 1) }}>Try again</button></div>}
  {!courses ? !error && <p role="status">Loading courses…</p> : !courses.length ? <div className="studio-empty"><h3>New courses are on the way.</h3><p>Courses will appear here when they are published.</p></div> : <>
   <div className="course-toolbar"><input className="search-input" aria-label="Search courses" placeholder="Find a course…" value={query} onChange={e => setQuery(e.target.value)} /></div>
   {user ? <>
    <section className="learner-course-collection" aria-labelledby="my-learning-courses"><div className="section-title"><h3 id="my-learning-courses">My courses</h3><span>{filtered.filter(course=>enrolledIds.has(course.id)).length} courses</span></div>
     {filtered.some(course=>enrolledIds.has(course.id)) ? <div className="studio-course-grid">{filtered.filter(course=>enrolledIds.has(course.id)).map(course=><CourseCard course={course} key={course.id}><Link className="btn" to={`/dashboard/learn/courses/${course.id}`}>Open course</Link></CourseCard>)}</div> : <p className="course-collection-empty">{query ? 'No enrolled courses match your search.' : 'You have not enrolled in a published course yet. Choose an available course below.'}</p>}
    </section>
    <section className="learner-course-collection" aria-labelledby="available-learning-courses"><div className="section-title"><h3 id="available-learning-courses">Available courses</h3><span>{filtered.filter(course=>!enrolledIds.has(course.id)).length} courses</span></div>
     {filtered.some(course=>!enrolledIds.has(course.id)) ? <div className="studio-course-grid">{filtered.filter(course=>!enrolledIds.has(course.id)).map(course=><CourseCard course={course} key={course.id}><button className="btn" disabled={Boolean(busy)} onClick={()=>enroll(course.id)}>{busy===course.id?'Enrolling…':'Enroll in course'}</button></CourseCard>)}</div> : <p className="course-collection-empty">{query ? 'No available courses match your search.' : 'You are enrolled in every published course.'}</p>}
    </section>
   </> : <div className="studio-course-grid">{filtered.map(course=><CourseCard course={course} key={course.id}><Link className="text-link" to="/register?next=/dashboard/learn/courses">Create an account to enroll</Link></CourseCard>)}</div>}
   {!filtered.length && <div className="studio-empty"><h3>No courses found.</h3><p>Try another search.</p><button className="btn btn-secondary" onClick={() => setQuery('')}>Clear search</button></div>}
  </>}
 </section>
}
