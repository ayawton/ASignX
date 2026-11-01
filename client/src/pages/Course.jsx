import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Link from '../components/WorkspaceLink'
import { api } from '../auth'

export default function Course() {
 const { id } = useParams()
 return <CourseDetails key={id} id={id} />
}

function CourseDetails({ id }) {
 const [course, setCourse] = useState(null)
 const [error, setError] = useState('')
 const [attempt, setAttempt] = useState(0)
 useEffect(() => {
  let active = true
  api(`/me/courses/${encodeURIComponent(id)}`).then(value => {
   if (active) { setCourse(value); setError('') }
  }).catch(error => { if (active) setError(error.message) })
  return () => { active = false }
 }, [id, attempt])
 return <section className="container studio-section studio-page">
  <Link className="text-link" to="/dashboard">Back to dashboard</Link>
  {error ? <div role="alert"><p>{error}</p><button className="btn" type="button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Try again</button></div> : !course ? <p role="status">Loading your course…</p> : <>
   <div className="page-heading"><div><span className="text-label">Your enrolled course</span><h1>{course.title}</h1>{course.description && <p>{course.description}</p>}</div></div>
   <article className="studio-progress-panel"><h2>Course lessons</h2>
    {course.lessons.length ? <><p>Lessons are listed in course order. Open a lesson to review its material and questions.</p><ol>{course.lessons.map(lesson => <li key={lesson.id}><h3><Link to={`/learn/lessons/${lesson.id}`}>{lesson.title}</Link></h3><p>{lesson.completed_at ? 'Completed' : lesson.started_at ? 'In progress' : 'Not started'} · {lesson.xp_reward} XP on completion</p></li>)}</ol></> : <p>No published lessons are available for this course yet. Check back later.</p>}
   </article>
  </>}
 </section>
}
