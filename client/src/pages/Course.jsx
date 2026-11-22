import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Link from '../components/WorkspaceLink'
import { api } from '../auth'
import CourseCover from '../components/CourseCover'
import { coursePath } from '../data/learningPath'
import { Check, Play, ArrowRight, Circle } from 'lucide-react'

export default function Course() {
 const { id } = useParams()
 return <CourseDetails key={id} id={id} />
}

function CourseDetails({ id }) {
 const [course, setCourse] = useState(null)
 const [error, setError] = useState('')
 const [attempt, setAttempt] = useState(0)
 const path = course ? coursePath(course.lessons) : null
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
   <div className="learner-course-banner"><CourseCover course={course}/></div>
   <div className="page-heading"><div><span className="text-label">Your enrolled course</span><h1>{course.title}</h1>{course.description && <p>{course.description}</p>}</div></div>
   <article className="studio-progress-panel"><h2>Course lessons</h2>
    {path.total>0 && <div className="learning-path-summary"><p>{path.completed} of {path.total} lessons completed</p><progress aria-label="Course completion" value={path.completed} max={path.total} /><Link className="btn" to={`/learn/lessons/${path.target.id}`}>{path.completed===path.total ? 'Review course' : course.lessons.some(l=>l.started_at) ? 'Continue learning' : 'Start learning'}</Link></div>}
    {course.lessons.length ? <><p>Choose a lesson to start, continue, or review.</p><ol className="course-lesson-list">{course.lessons.map((lesson,index) => {
     const state=lesson.completed_at?'completed':lesson.started_at?'in-progress':'not-started'
     const status=lesson.completed_at?'Completed':lesson.started_at?'In progress':'Not started'
     const action=lesson.completed_at?'Review lesson':lesson.started_at?'Continue lesson':'Start lesson'
     const fill=lesson.completed_at?100:lesson.question_count?Math.min(100,Math.max(0,Math.round(lesson.solved_count/lesson.question_count*100))):0
     return <li key={lesson.id}><Link className={`course-lesson-row is-${state}`} style={{'--lesson-fill':`${fill}%`}} to={`/learn/lessons/${lesson.id}`}>
      <span className="course-lesson-fill" aria-hidden="true" />
      <span className="course-lesson-marker" aria-hidden="true">{index+1}</span>
      <div className="course-lesson-copy"><h3>{lesson.title}</h3><span className="course-lesson-status">{!lesson.completed_at&&(lesson.started_at?<Play size={12}/>:<Circle size={12}/>)} {status}</span><span className="course-lesson-xp">{lesson.xp_reward} XP {lesson.completed_at?'lesson reward':'on completion'}</span>{lesson.started_at&&!lesson.completed_at&&lesson.question_count>0&&<span className="course-lesson-count">{lesson.solved_count} of {lesson.question_count} questions correct</span>}</div>
      <span className="course-lesson-action">{action}{lesson.completed_at?<Check className="course-lesson-done" size={18} aria-hidden="true"/>:<ArrowRight size={16}/>}</span>
     </Link></li>
    })}</ol></> : <p>No published lessons are available for this course yet. Check back later.</p>}
   </article>
  </>}
 </section>
}
