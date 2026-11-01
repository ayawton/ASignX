import CourseCover from '../components/CourseCover'
import { useEffect, useState } from 'react'
import Link from '../components/WorkspaceLink'
import { ArrowUpRight, BookOpen, Camera, Gamepad2, Trophy, UserRound } from 'lucide-react'
import { api, useAuth } from '../auth'
import './Dashboard.css'

export default function Dashboard() {
 const { user } = useAuth()
 const [resources, setResources] = useState({})
 const [errors, setErrors] = useState({})
 const [attempt, setAttempt] = useState(0)
 const [busy, setBusy] = useState('')
 const [message, setMessage] = useState('')
 useEffect(() => {
  let active = true
  api('/me/dashboard').then(({resources,errors})=>{if(active){setResources(resources);setErrors(errors)}})
   .catch(error=>{if(active)setErrors(Object.fromEntries(['profile','progress','enrollments','courses'].map(key=>[key,error.message])))})
  return () => { active = false }
 }, [attempt, user?.id])
 async function enroll(course) {
  setBusy(course.id); setMessage('')
  try {
   await api('/me/enrollments', { method: 'POST', body: JSON.stringify({ course_id: course.id }) })
   const savedEnrollments = await api('/me/enrollments')
   setResources(previous => ({ ...previous, enrollments: savedEnrollments }))
   setMessage(`You're enrolled in ${course.title}.`)
  } catch (error) { setMessage(error.message) }
  finally { setBusy('') }
 }
 const { profile, progress, enrollments, courses } = resources
 const available = courses?.filter(course => !enrollments?.some(row => row.course_id === course.id))
 const name = profile?.display_name || user?.user_metadata?.display_name || 'there'
 return <div className="learner-overview">
  <section className="learner-content">
   <header className="learner-heading"><div><p>Your dashboard</p><h1>Hello, {name}.</h1><p>Make room for your next sign.</p></div><Link className="text-link" to="/profile">Your account <UserRound size={18} /></Link></header>
   {Object.keys(errors).length > 0 && <div className="learner-notice" role="alert"><p>Some dashboard information couldn’t load. Your saved records are safe.</p><ul>{Object.entries(errors).map(([key, error]) => <li key={key}>{key}: {error}</li>)}</ul><button type="button" className="text-link" onClick={() => setAttempt(value => value + 1)}>Try again</button></div>}
   {message && <p className="learner-notice" role="status">{message}</p>}
   <dl className="learner-metrics">{[['Enrolled courses', enrollments?.length], ['Completed lessons', progress?.lessons.filter(lesson => lesson.completed_at).length], ['Learning XP', progress?.xp], ['Day streak', progress?.streak]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}</dl>
   <div className="learner-columns"><div>
    <section className="learner-section"><div className="learner-section-heading"><h2>My courses</h2><BookOpen size={21} /></div>
     {!enrollments ? <p role="status">{errors.enrollments ? 'Your courses are unavailable. Try again above.' : 'Loading your courses…'}</p> : enrollments.length ? <div className="learner-course-list">{enrollments.map(course => <article key={course.course_id}><div className="learner-course-thumbnail" aria-hidden="true"><CourseCover course={course}/></div><div className="learner-course-copy"><h3>{course.title}</h3><div className={`overview-course-progress${course.total_lessons>0 && course.completed_lessons===course.total_lessons ? ' is-complete' : ''}`}><span>{course.total_lessons ? course.completed_lessons===course.total_lessons ? 'Completed' : `${course.completed_lessons} of ${course.total_lessons} lessons completed` : 'No published lessons'}</span>{course.total_lessons>0 && <progress aria-label={`Progress for ${course.title}`} value={course.completed_lessons} max={course.total_lessons}/>}</div></div>{course.is_published ? <Link className="text-link" to={`/learn/courses/${course.course_id}`}>{course.total_lessons>0 && course.completed_lessons===course.total_lessons ? 'Review' : course.started_lessons>0 || course.completed_lessons>0 ? 'Continue' : 'Start'} <ArrowUpRight size={16} /></Link> : <span className="learner-enrolled">Unavailable</span>}</article>)}</div> : <div className="learner-empty"><BookOpen size={28} /><h3>Your first course starts here.</h3><p>Enroll in an available course below. It will appear here whenever you return.</p></div>}
    </section>
    <section id="dashboard-courses" className="learner-section"><div className="learner-section-heading"><h2>Explore ASign Learn</h2></div>
     {!courses ? <p role="status">{errors.courses ? 'Courses are unavailable. Try again above.' : 'Loading available courses…'}</p> : available.length ? <div className="learner-catalog">{available.map(course => <article key={course.id}><CourseCover course={course} /><h3>{course.title}</h3><p>{course.description}</p><button className="btn" type="button" disabled={Boolean(busy) || !enrollments || Boolean(errors.enrollments)} onClick={() => enroll(course)}>{busy === course.id ? 'Enrolling…' : 'Enroll in course'}<ArrowUpRight size={16} /></button></article>)}</div> : <div className="learner-empty"><h3>{courses.length ? 'You’re enrolled in every available course.' : 'New courses are on the way.'}</h3><p>{courses.length ? 'Your courses are listed above.' : 'Published courses will appear here when they are ready.'}</p></div>}
     <Link className="text-link learner-practice-link" to="/learn">Browse all courses <ArrowUpRight size={16} /></Link>
    </section>
   </div><aside className="learner-details">
    <section className="learner-account"><UserRound size={23} /><h2>Your information</h2>{profile ? <dl><dt>Name</dt><dd>{profile.display_name}</dd><dt>Email</dt><dd>{profile.email}</dd><dt>Time zone</dt><dd>{profile.timezone}</dd></dl> : <p>{errors.profile ? 'Your information is unavailable.' : 'Loading your information…'}</p>}<Link className="text-link" to="/profile">Edit profile <ArrowUpRight size={16} /></Link></section>
    <section className="learner-shortcuts"><h2>Keep exploring</h2><Link to="/live"><Camera size={22} /><div><strong>ASignLive</strong><p>Live alphabet recognition</p></div><ArrowUpRight size={17} /></Link><Link to="/learn/arcade"><Gamepad2 size={22} /><div><strong>Sign Strike</strong><p>A little playful practice</p></div><ArrowUpRight size={17} /></Link><Link to="/progress"><Trophy size={22} /><div><strong>Your achievements</strong><p>{progress ? `${progress.achievements.length} unlocked` : 'View your learning record'}</p></div><ArrowUpRight size={17} /></Link></section>
   </aside></div>
  </section>
 </div>
}

