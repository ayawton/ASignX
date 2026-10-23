import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../auth'
export default function Progress() {
 const [data, setData] = useState(null), [error, setError] = useState('')
 useEffect(() => { let active = true; api('/me/progress').then(value => { if (active) setData(value) }).catch(e => { if (active) setError(e.message) }); return () => { active = false } }, [])
 return <section className="container studio-section studio-page"><div className="page-heading"><div><span className="text-label">Your account progress</span><h1>Every sign is a step forward.</h1><p>Verified account records stay separate from practice saved in this browser.</p></div></div>{error ? <p role="alert">{error}</p> : !data ? <p role="status">Loading your progress…</p> : <><div className="studio-stats"><div className="studio-stat"><strong>{data.lessons.filter(l => l.completed_at).length}</strong><span>Completed lessons</span></div><div className="studio-stat"><strong>{data.xp}</strong><span>Verified XP</span></div><div className="studio-stat"><strong>{data.achievements.length}</strong><span>Achievements</span></div><div className="studio-stat"><strong>{data.streak}</strong><span>Day streak</span></div></div><article className="studio-progress-panel"><h2>Your learning record</h2>{data.lessons.length ? data.lessons.map(l => <p key={l.lesson_id}>{l.title} — {l.completed_at ? 'Completed' : 'In progress'}</p>) : <p>No account lessons recorded yet. Written sample introductions are guest practice and do not award account XP.</p>}{data.achievements.map(a => <p key={a.id}>{a.name}: {a.description}</p>)}<Link className="text-link" to="/learn">Explore learning</Link></article></>}</section>
}

