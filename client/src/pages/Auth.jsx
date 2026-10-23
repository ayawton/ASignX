import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { registerAccount } from '../registration'
import ConfirmationResend from '../components/ConfirmationResend'
import { resendConfirmation } from '../confirmation'
import { Artwork } from '../components/StudioKit'
import { internalPath, supabase, useAuth } from '../auth'
export function Login() { return <Auth mode="login" /> }
export function Register() { return <Auth mode="register" /> }
export { default as ForgotPassword } from './ForgotPassword'
export function ResetPassword() { return <Auth mode="reset" /> }
export { default as AuthCallback } from './AuthCallback'
function Auth({ mode }) {
 const register = mode === 'register', reset = mode === 'reset', forgot = mode === 'forgot'
 const [show, setShow] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('')
 const [needsConfirmation, setNeedsConfirmation] = useState(false)
 const [registeredEmail, setRegisteredEmail] = useState('')
 const [params] = useSearchParams(), navigate = useNavigate()
 const { user, loading } = useAuth()
 const next = internalPath(params.get('next'))
 useEffect(() => { if (mode === 'login' && !loading && user?.email_confirmed_at) navigate(next, { replace: true }) }, [mode, loading, user, next, navigate])
 async function submit(e) {
  e.preventDefault(); if (busy) return; setMessage(''); setNeedsConfirmation(false); setBusy(true)
  const form = e.currentTarget
  const values = Object.fromEntries(new FormData(e.currentTarget))
  try {
   if (register) {
    const data = await registerAccount(supabase, values, window.location.origin, next)
    form.reset()
    if (data.session?.user?.email_confirmed_at) navigate(next, { replace: true })
    else setRegisteredEmail(values.email.trim())
    return
   }
   if (!supabase) throw new Error('Accounts need project configuration before they can connect. Public lessons and guest practice are available.')
   let result
   if (forgot) result = await supabase.auth.resetPasswordForEmail(values.email, { redirectTo: `${window.location.origin}/reset-password` })
   else if (reset) result = await supabase.auth.updateUser({ password: values.password })
   else result = await supabase.auth.signInWithPassword({ email: values.email, password: values.password })
   if (result.error) throw result.error
   if (forgot) setMessage('If an account matches this address, a password reset link will arrive by email.')
   else if (reset) { setMessage('Password updated.'); navigate('/profile', { replace: true }) }
   else navigate(next, { replace: true })
  } catch (error) { setMessage(error.message); setNeedsConfirmation(mode === 'login' && error.code === 'email_not_confirmed') } finally { setBusy(false) }
 }
 async function resend(e) {
  const form = e.currentTarget.closest('form'), email = new FormData(form).get('email')
  if (!email || !form.reportValidity() || !supabase) return
  setBusy(true)
  try { await resendConfirmation(supabase, email, window.location.origin, next); setMessage('If eligible, a new confirmation email will arrive shortly.') } catch (error) { setMessage(error.message) } finally { setBusy(false) }
 }
 return <section className="container studio-auth"><div className="studio-auth-art"><span className="text-label">Good to have you here.</span><h2>Different hands.<br />A shared world.</h2><Artwork /><p>Your next connection starts with a little curiosity.</p></div><div className="studio-auth-form"><span className="text-label">Your ASignX journey</span><h1>{register ? 'Start something good.' : forgot ? 'Find your way back.' : reset ? 'A fresh start.' : 'Hello again.'}</h1><p>{register ? 'Create your account to keep your learning journey in one place. All four fields are required.' : 'Keep your profile and verified learning progress with your account. Guest practice stays separate.'}</p>{register && registeredEmail ? <div className="studio-auth-message" role="status"><h2>Check your email.</h2><p>If this address is eligible, a confirmation link has been sent to <strong>{registeredEmail}</strong>. Open it to confirm your account, then log in.</p><p>Check your spam folder if you don’t see the message.</p><ConfirmationResend key={registeredEmail} email={registeredEmail} next={next} /><Link className="text-link" to={`/login?next=${encodeURIComponent(next)}`}>Continue to log in <ArrowUpRight size={16} /></Link><button className="text-link studio-registration-retry" type="button" onClick={() => { setRegisteredEmail(''); setMessage('') }}>Use another email address</button></div> : <form onSubmit={submit} aria-busy={busy}>{register && <label>Display name<input name="name" required maxLength={100} pattern=".*\S.*" autoComplete="nickname" aria-describedby="register-name-help" placeholder="What should we call you?" /><small id="register-name-help">The name shown on your profile. Up to 100 characters.</small></label>}{!reset && <label>Email address<input name="email" onChange={() => setNeedsConfirmation(false)} required type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="you@example.com" />{register && <small>Use an email address you can access for account confirmation.</small>}</label>}{!forgot && <label>Password<div className="studio-password"><input name="password" required minLength={mode === 'login' ? 1 : 8} type={show ? 'text' : 'password'} autoComplete={register || reset ? 'new-password' : 'current-password'} placeholder={mode === 'login' ? 'Your password' : 'At least 8 characters'} /><button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button></div>{register && <small>Use at least 8 characters. Choose a longer, unique password.</small>}</label>}{register && <label>Confirm password<div className="studio-password"><input name="confirmPassword" required minLength={8} type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="Enter your password again" /><button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide confirmation password' : 'Show confirmation password'}>{show ? 'Hide' : 'Show'}</button></div><small>Enter the same password to check for typos.</small></label>}<button className="btn" disabled={busy || (reset && (!user || loading))} type="submit">{busy ? (register ? 'Creating account…' : 'Please wait…') : register ? 'Create account' : forgot ? 'Send reset link' : reset ? 'Update password' : 'Log in'} <ArrowUpRight size={18} /></button>{mode === 'login' && <div className="studio-auth-recovery-links"><Link className="text-link" to={`/forgot-password?next=${encodeURIComponent(next)}`}>Forgot password?</Link>{needsConfirmation && <button type="button" className="text-link" disabled={busy} onClick={resend}>Resend confirmation email</button>}</div>}{message && <div className="studio-auth-message" role="status">{message}</div>}{reset && !loading && !user && <p role="status">Open the password reset link from your email to continue.</p>}</form>}<p className="studio-auth-switch"><Link to={`${register ? '/login' : '/register'}?next=${encodeURIComponent(next)}`}>{register ? 'Already have an account? Log in' : 'Create an account'}</Link></p><Link to="/learn">Keep exploring as a guest</Link></div></section>
}
