import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { registerAccount } from '../registration'
import ConfirmationResend from '../components/ConfirmationResend'
import { Artwork } from '../components/StudioKit'
import { internalPath, supabase, useAuth } from '../auth'

export { default as Login } from './Login'
export { default as ForgotPassword } from './ForgotPassword'
export { default as AuthCallback } from './AuthCallback'
export function Register() { return <Auth register /> }
export function ResetPassword() { return <Auth /> }

function Auth({ register = false }) {
 const [show, setShow] = useState(false)
 const [busy, setBusy] = useState(false)
 const [message, setMessage] = useState('')
 const [registeredEmail, setRegisteredEmail] = useState('')
 const [params] = useSearchParams(), navigate = useNavigate()
 const { user, loading } = useAuth()
 const next = internalPath(params.get('next'))
 async function submit(e) {
  e.preventDefault()
  if (busy) return
  setMessage(''); setBusy(true)
  const form = e.currentTarget
  const values = Object.fromEntries(new FormData(form))
  try {
   if (register) {
    const data = await registerAccount(supabase, values, window.location.origin, next)
    form.reset()
    if (data.session?.user?.email_confirmed_at) navigate(next, { replace: true })
    else setRegisteredEmail(values.email.trim())
   } else {
    if (!supabase) throw new Error('Password reset is temporarily unavailable. Please try again later.')
    const { error } = await supabase.auth.updateUser({ password: values.password })
    if (error) throw error
    navigate('/profile', { replace: true })
   }
  } catch (error) { setMessage(error.message) } finally { setBusy(false) }
 }
 return <section className="container studio-auth">
  <div className="studio-auth-art"><span className="text-label">Good to have you here.</span><h2>Different hands.<br />A shared world.</h2><Artwork /><p>Your next connection starts with a little curiosity.</p></div>
  <div className="studio-auth-form"><span className="text-label">Your ASignX journey</span><h1>{register ? 'Start something good.' : 'A fresh start.'}</h1><p>{register ? 'Create your account to keep your learning journey in one place. All four fields are required.' : 'Choose a new password to get back to your learning journey.'}</p>
   {register && registeredEmail ? <div className="studio-auth-message" role="status">
    <h2>Check your email.</h2><p>If this address is eligible, a confirmation link has been sent to <strong>{registeredEmail}</strong>. Open it to confirm your account, then log in.</p><p>Check your spam folder if you don’t see the message.</p>
    <ConfirmationResend key={registeredEmail} email={registeredEmail} next={next} />
    <Link className="text-link" to={`/login?next=${encodeURIComponent(next)}`}>Continue to log in <ArrowUpRight size={16} /></Link>
    <button className="text-link studio-registration-retry" type="button" onClick={() => { setRegisteredEmail(''); setMessage('') }}>Use another email address</button>
   </div> : <form onSubmit={submit} aria-busy={busy}>
    {register && <>
     <label>Display name<input name="name" required maxLength={100} pattern=".*\S.*" autoComplete="nickname" aria-describedby="register-name-help" placeholder="What should we call you?" /><small id="register-name-help">The name shown on your profile. Up to 100 characters.</small></label>
     <label>Email address<input name="email" required type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="you@example.com" /><small>Use an email address you can access for account confirmation.</small></label>
    </>}
    <label>Password<div className="studio-password"><input name="password" required minLength={8} type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 8 characters" /><button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button></div>{register && <small>Use at least 8 characters. Choose a longer, unique password.</small>}</label>
    {register && <label>Confirm password<div className="studio-password"><input name="confirmPassword" required minLength={8} type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="Enter your password again" /><button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide confirmation password' : 'Show confirmation password'}>{show ? 'Hide' : 'Show'}</button></div><small>Enter the same password to check for typos.</small></label>}
    <button className="btn" disabled={busy || (!register && (!user || loading))} type="submit">{busy ? (register ? 'Creating account…' : 'Updating password…') : register ? 'Create account' : 'Update password'} <ArrowUpRight size={18} /></button>
    {message && <div className="studio-auth-message" role="status">{message}</div>}
    {!register && !loading && !user && <p role="status">Open the password reset link from your email to continue.</p>}
   </form>}
   <p className="studio-auth-switch"><Link to={`/login?next=${encodeURIComponent(next)}`}>{register ? 'Already have an account? Log in' : 'Back to log in'}</Link></p><Link to="/learn">Keep exploring as a guest</Link>
  </div>
 </section>
}
