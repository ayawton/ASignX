import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, Mail, ShieldCheck } from 'lucide-react'
import { internalPath, supabase } from '../auth'

export default function ForgotPassword() {
 const [email, setEmail] = useState('')
 const [busy, setBusy] = useState(false)
 const [sent, setSent] = useState(false)
 const [error, setError] = useState('')
 const [params] = useSearchParams()
 const loginPath = `/login?next=${encodeURIComponent(internalPath(params.get('next')))}`

 async function submit(e) {
  e.preventDefault()
  setBusy(true)
  setError('')
  try {
   if (!supabase) throw new Error('Password reset is currently unavailable. Please try again later.')
   const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
   })
   if (error) throw error
   setSent(true)
  } catch (error) {
   setError(error.message || 'We could not request a reset link. Please try again.')
  } finally {
   setBusy(false)
  }
 }

 return <section className="container studio-auth studio-recovery">
  <div className="studio-auth-form studio-recovery-form">
   <Link className="text-link studio-recovery-back" to={loginPath}><ArrowLeft size={16} /> Back to log in</Link>
   <span className="studio-recovery-icon" aria-hidden="true"><Mail size={26} /></span>
   <h1>{sent ? 'Check your inbox.' : 'Forgot password?'}</h1>
   {sent ? <div className="studio-recovery-sent" role="status">
    <p>If an account uses <strong>{email.trim()}</strong>, you’ll receive an email with a link to reset your password.</p>
    <p>Check your spam folder too. The email may take a few minutes to arrive.</p>
    <Link className="btn" to={loginPath}>Back to log in <ArrowUpRight size={18} /></Link>
    <button className="text-link" type="button" onClick={() => { setSent(false); setError('') }}>Try another email address</button>
   </div> : <>
    <p>Enter the email address you used for your account. We’ll send you a link to choose a new password.</p>
    <form onSubmit={submit} aria-busy={busy}>
     <label htmlFor="recovery-email">Email address</label>
     <input id="recovery-email" name="email" required type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="you@example.com" value={email} onChange={e => { setEmail(e.target.value); setError('') }} aria-invalid={Boolean(error)} aria-describedby={error ? 'recovery-error' : undefined} disabled={busy} />
     {error && <p id="recovery-error" className="studio-recovery-error" role="alert">{error}</p>}
     <button className="btn" disabled={busy} type="submit">{busy ? 'Sending reset link…' : 'Send reset link'} <ArrowUpRight size={18} /></button>
    </form>
   </>}
   <div className="studio-storage-note"><ShieldCheck size={16} /><span>For your privacy, we won’t reveal whether an email has an account.</span></div>
   <Link className="text-link studio-recovery-guest" to="/learn">Keep exploring as a guest <ArrowUpRight size={15} /></Link>
  </div>
 </section>
}
