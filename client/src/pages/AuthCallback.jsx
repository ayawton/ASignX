import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CheckCircle2, Mail } from 'lucide-react'
import { confirmEmail } from '../confirmation'
import { internalPath, supabase } from '../auth'
import ConfirmationResend from '../components/ConfirmationResend'

export default function AuthCallback() {
 const location = useLocation()
 const next = internalPath(new URLSearchParams(location.search).get('next'))
 const verification = useRef(null)
 const [status, setStatus] = useState('loading')
 const [message, setMessage] = useState('Checking your confirmation link…')
 useEffect(() => {
  let active = true
  if (!verification.current) {
   const callbackUrl = window.location.href
   // Remove tokens and verification codes from the address bar before rendering results.
   window.history.replaceState(window.history.state, '', `/auth/callback?next=${encodeURIComponent(next)}`)
   verification.current = confirmEmail(supabase, callbackUrl)
  }
  verification.current.then(() => { if (active) { setStatus('success'); setMessage('Your email is confirmed. You’re ready to continue your learning journey.') } }).catch(error => { if (active) { setStatus('error'); setMessage(error.message) } })
  return () => { active = false }
 }, [next])
 return <section className="container studio-section studio-page studio-confirmation-page"><div className="studio-auth-form">
  <span className="studio-recovery-icon" aria-hidden="true">{status === 'success' ? <CheckCircle2 size={26} /> : <Mail size={26} />}</span>
  <h1>{status === 'success' ? 'Email confirmed.' : status === 'error' ? 'Let’s confirm your email.' : 'Confirming your email…'}</h1>
  <p role={status === 'error' ? 'alert' : 'status'}>{message}</p>
  {status === 'success' && <Link className="btn" to={next}>Continue learning</Link>}
  {status === 'error' && <ConfirmationResend next={next} />}
  <p><Link className="text-link" to={`/login?next=${encodeURIComponent(next)}`}>Back to log in</Link></p>
 </div></section>
}
