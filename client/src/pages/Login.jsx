import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import ConfirmationResend from '../components/ConfirmationResend'
import { internalPath, supabase, useAuth } from '../auth'
import { loginAccount } from '../login'

export default function Login() {
 const [params] = useSearchParams()
 const next = internalPath(params.get('next'))
 const navigate = useNavigate()
 const { user, loading, error: sessionError } = useAuth()
 const [email, setEmail] = useState('')
 const [password, setPassword] = useState('')
 const [show, setShow] = useState(false)
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState('')
 const [needsConfirmation, setNeedsConfirmation] = useState(false)
 const submitted = useRef(false)
 useEffect(() => {
  if (!submitted.current && !loading && user?.email_confirmed_at) navigate(next, { replace: true })
 }, [loading, user, navigate, next])
 async function submit(e) {
  e.preventDefault()
  if (submitted.current || loading) return
  submitted.current = true
  setBusy(true); setError(''); setNeedsConfirmation(false)
  try {
   await loginAccount(supabase, { email, password })
   setPassword('')
   navigate(next, { replace: true })
  } catch (error) {
   setError(error.message)
   setNeedsConfirmation(error.code === 'email_not_confirmed')
  } finally { submitted.current = false; setBusy(false) }
 }
 return <section className="container studio-auth">
  <div className="studio-auth-form"><span className="text-label">Your ASignX journey</span><h1>Hello again.</h1><p>Log in to keep your learning journey going.</p>
   <form onSubmit={submit} aria-busy={busy}>
    <label htmlFor="login-email">Email address<input id="login-email" name="email" required type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="you@example.com" disabled={busy} value={email} onChange={e => { setEmail(e.target.value); setError(''); setNeedsConfirmation(false) }} /></label>
    <label htmlFor="login-password">Password<div className="studio-password"><input id="login-password" name="password" required type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Your password" disabled={busy} value={password} onChange={e => { setPassword(e.target.value); setError('') }} /><button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button></div></label>
    <button className="btn" disabled={busy || loading} type="submit">{busy ? 'Logging in…' : loading ? 'Restoring your session…' : 'Log in'} <ArrowUpRight size={18} /></button>
    <div className="studio-auth-recovery-links"><Link className="text-link" to={`/forgot-password?next=${encodeURIComponent(next)}`}>Forgot password?</Link></div>
    {(error || sessionError) && <div className="studio-auth-message" role="alert">{error || sessionError}</div>}
   </form>
   {needsConfirmation && <ConfirmationResend key={email.trim()} email={email.trim()} next={next} />}
   <p className="studio-auth-switch">New around here? <Link to={`/register?next=${encodeURIComponent(next)}`}>Create an account</Link></p>
   <Link to="/learn">Keep exploring as a guest</Link>
  </div>
 </section>
}
