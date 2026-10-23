import { useEffect, useState } from 'react'
import { resendConfirmation } from '../confirmation'
import { supabase } from '../auth'

export default function ConfirmationResend({ email, next }) {
 const [address, setAddress] = useState(email || '')
 const [busy, setBusy] = useState(false)
 const [remaining, setRemaining] = useState(email ? 60 : 0)
 const [message, setMessage] = useState('')
 const [error, setError] = useState('')
 useEffect(() => {
  if (!remaining) return
  const timer = setTimeout(() => setRemaining(value => Math.max(0, value - 1)), 1000)
  return () => clearTimeout(timer)
 }, [remaining])
 async function resend(e) {
  e.preventDefault()
  if (busy || remaining) return
  setBusy(true); setMessage(''); setError('')
  try {
   await resendConfirmation(supabase, address, window.location.origin, next)
   setMessage('If this address is awaiting confirmation, a new link will arrive shortly. Check your spam folder too.')
   setRemaining(60)
  } catch (error) {
   setError(error.message)
   if (error.status === 429 || error.code === 'over_email_send_rate_limit') setRemaining(60)
  } finally { setBusy(false) }
 }
 return <form className="studio-confirmation-resend" onSubmit={resend} aria-busy={busy}>
  {!email && <label>Email address<input name="confirmationEmail" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required value={address} onChange={e => setAddress(e.target.value)} placeholder="you@example.com" /></label>}
  <button className="text-link" type="submit" disabled={busy || remaining > 0}>{busy ? 'Sending confirmation…' : remaining ? `Resend in ${remaining}s` : 'Resend confirmation email'}</button>
  {message && <p role="status">{message}</p>}
  {error && <p role="alert">{error}</p>}
 </form>
}

