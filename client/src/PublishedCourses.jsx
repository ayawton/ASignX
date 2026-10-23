import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, useAuth } from './auth'
export default function PublishedCourses() {
 const { user } = useAuth(), [courses, setCourses] = useState([]), [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
 useEffect(() => { let active = true; api('/courses').then(rows => { if (active) setCourses(rows) }).catch(() => { if (active) setMessage('Published account courses are unavailable right now. You can still explore the sample introductions below.') }); return () => { active = false } }, [])
 async function enroll(id) { setBusy(true); try { await api('/me/enrollments', { method: 'POST', body: JSON.stringify({ course_id: id }) }); setMessage('You are enrolled. Your enrollment is saved to your account.') } catch (e) { setMessage(e.message) } finally { setBusy(false) } }
 return <div className="studio-progress-panel"><h2>Published account courses</h2><p>Sample practice below stays in this browser. Enroll in a published course to save membership to your account.</p>{message && <p role="status">{message}</p>}{courses.map(course => <article key={course.id}><h3>{course.title}</h3><p>{course.description}</p>{user ? <button className="btn" disabled={busy} onClick={() => enroll(course.id)}>Enroll</button> : <Link to="/login?next=/learn/courses">Log in to enroll</Link>}</article>)}{!courses.length && !message && <p>No published account courses available yet.</p>}{!user && <p><Link to="/register?next=/learn/courses">Create an account</Link> to save enrollments, verified progress and rewards. Guest learning remains available.</p>}</div>
}
