import { useEffect, useState } from 'react'
import { BadgeArt } from './Achievements'
import { api } from '../auth'
import Link from './WorkspaceLink'
import './Achievements.css'

export default function AchievementNotice() {
 const [earned, setEarned] = useState([])
 useEffect(() => {
  let active = true, known, request = 0
  async function check() {
   const sequence = ++request
   try {
    const { achievements } = await api('/me/progress')
    if (!active || sequence !== request) return
    const added = known ? achievements.filter(badge => !known.has(badge.id)) : []
    known = new Set(achievements.map(badge => badge.id))
    if (added.length) setEarned(previous => [...previous, ...added])
   } catch { /* Badge notifications must not interrupt learning. */ }
  }
  check()
  window.addEventListener('asignx-learning-activity', check)
  return () => { active = false; window.removeEventListener('asignx-learning-activity', check) }
 }, [])
 useEffect(() => {
  if (!earned.length) return
  const timer = setTimeout(() => setEarned([]), 8000)
  return () => clearTimeout(timer)
 }, [earned])
 return <div className="badge-announcer" aria-live="polite">
  {earned.length > 0 && <div className="badge-notice"><BadgeArt badge={earned[0]} />
   <div><strong>{earned.length === 1 ? 'Achievement unlocked' : 'Achievements unlocked'}</strong>
    <p>{earned.map(badge => badge.name).join(', ')}</p></div>
   <Link to="/progress#achievements" onClick={() => setEarned([])}>View</Link>
   <button type="button" aria-label="Dismiss achievement notification" onClick={() => setEarned([])}>×</button>
  </div>}
 </div>
}
