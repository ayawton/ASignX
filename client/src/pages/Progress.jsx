import { useEffect, useState } from 'react'
import Link from '../components/WorkspaceLink'
import { BadgeCollection } from '../components/Achievements'
import { api, useAuth } from '../auth'

export default function Progress() {
 const { user } = useAuth()
 const [data, setData] = useState(null)
 const [error, setError] = useState('')
 const [retry, setRetry] = useState(0)
 useEffect(() => {
  let active = true
  api('/me/progress').then(value => { if (active) setData(value) })
   .catch(failure => { if (active) setError(failure.message) })
  return () => { active = false }
 }, [retry])
 const completed = data?.lessons.filter(lesson => lesson.completed_at).length ?? 0
 const badges = data?.badges ?? data?.achievements ?? []
 return <section className="container studio-section studio-page achievement-page">
  <header className="page-heading"><div><h1>Your progress</h1>{user?.role === 'guest' && <p>Guest badges and progress expire with this session.</p>}</div></header>
  {error ? <p role="alert">{error} <button className="text-link" onClick={() => { setError(''); setRetry(value => value + 1) }}>Retry</button></p> :
   !data ? <p role="status">Loading your progress…</p> : <>
    <div className="studio-stats">
     <div className="studio-stat"><strong>{completed}</strong><span>Completed lessons</span></div>
     <div className="studio-stat"><strong>{data.xp}</strong><span>XP</span></div>
     <div className="studio-stat"><strong>{data.achievements.length}</strong><span>Badges earned</span></div>
     <div className="studio-stat"><strong>{data.streak}</strong><span>Day streak</span></div>
    </div>
    <section id="achievements" className="studio-progress-panel">
     <h2>Achievements</h2>
     {badges.length ? <BadgeCollection badges={badges} /> : <p>No achievements are available yet.</p>}
    </section>
    <section className="studio-progress-panel"><h2>Learning record</h2>
     {data.lessons.length ? <ul className="badge-list">{data.lessons.map(lesson => <li className="learning-record-row" key={lesson.lesson_id}>{lesson.title}<span>{lesson.completed_at ? 'Completed' : 'In progress'}</span></li>)}</ul> : <p>No lessons started yet.</p>}
     <Link className="text-link" to="/learn">Explore learning</Link>
    </section>
   </>}
 </section>
}
