import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth'

export default function Guest() {
 const { user, loading, enterGuest } = useAuth()
 const [error, setError] = useState('')
 const [attempt, setAttempt] = useState(0)

 useEffect(() => {
  if (loading || user) return
  let active = true
  enterGuest().catch(failure => {
   if (active) setError(failure.message)
  })
  return () => { active = false }
 }, [loading, user, enterGuest, attempt])

 if (user) return <Navigate to="/dashboard" replace />
 return <section className="container studio-auth">
  <div className="studio-auth-form">
   <h1>Continue as guest</h1>
   {error ? <>
    <p role="alert">{error}</p>
    <button className="btn" type="button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Try again</button>
   </> : <p role="status">Opening your dashboard…</p>}
   <p><Link to="/learn">Explore ASignLearn</Link> · <Link to="/login">Log in</Link></p>
  </div>
 </section>
}
