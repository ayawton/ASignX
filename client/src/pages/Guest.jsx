import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase, useAuth } from '../auth'
import { loginGuest } from '../login'

export default function Guest() {
 const { user, loading, error: sessionError } = useAuth()
 const [error, setError] = useState('')
 const [attempt, setAttempt] = useState(0)

 useEffect(() => {
  if (loading || user || sessionError) return
  let active = true
  loginGuest(supabase).catch(failure => {
   if (active) setError(failure.message)
  })
  return () => { active = false }
 }, [loading, user, sessionError, attempt])

 if (user) return <Navigate to="/dashboard" replace />
 const failure = error || sessionError
 return <section className="container studio-auth">
  <div className="studio-auth-form">
   <h1>Continue as guest</h1>
   {failure ? <>
    <p role="alert">{failure}</p>
    {!sessionError && <button className="btn" type="button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Try again</button>}
   </> : <p role="status">Opening your dashboard…</p>}
   <p><Link to="/learn">Explore ASignLearn</Link> · <Link to="/login">Log in</Link></p>
  </div>
 </section>
}
