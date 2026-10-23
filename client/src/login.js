function loginError(error) {
 const code = error?.code || 'login_unavailable'
 const message = code === 'invalid_credentials' ? 'Email or password is incorrect.'
  : code === 'email_not_confirmed' ? 'Confirm your email before logging in.'
  : error?.status === 429 ? 'Too many login attempts. Please wait a moment and try again.'
  : 'Unable to log in right now. Please try again.'
 return Object.assign(new Error(message), { code })
}

export async function verifiedSession(client, session) {
 if (!session?.access_token) return null
 const { data, error } = await client.auth.getUser(session.access_token)
 if (error) throw loginError(error)
 if (!data?.user?.email_confirmed_at) throw Object.assign(new Error('Confirm your email before logging in.'), { code: 'email_not_confirmed' })
 return { ...session, user: data.user }
}

export async function loginAccount(client, values) {
 const email = typeof values.email === 'string' ? values.email.trim() : ''
 if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.')
 if (typeof values.password !== 'string' || !values.password) throw new Error('Enter your password.')
 if (!client) throw new Error('Login is temporarily unavailable. Please try again later.')
 let result
 try { result = await client.auth.signInWithPassword({ email, password: values.password }) }
 catch { throw loginError() }
 if (result.error) throw loginError(result.error)
 try {
  const session = await verifiedSession(client, result.data?.session)
  if (!session) throw loginError()
  return session
 } catch (error) {
  // Do not keep a partly accepted login when identity verification fails.
  try { await client.auth.signOut({ scope: 'local' }) } catch { /* Keep the original login failure. */ }
  throw error
 }
}

// Auth callbacks must return synchronously to avoid Supabase auth-lock deadlocks.
// Every incoming session is verified outside that callback; revisions discard stale results.
export function observeSession(client, update) {
 let active = true, revision = 0, latestVerification = Promise.resolve()
 function accept(session) {
  const version = ++revision
  if (!session) {
   if (active) update({ session: null, loading: false, error: '' })
   latestVerification = Promise.resolve()
   return latestVerification
  }
  latestVerification = Promise.resolve().then(async () => {
   try {
    const confirmed = await verifiedSession(client, session)
    if (active && revision === version) update({ session: confirmed, loading: false, error: '' })
   } catch {
    if (active && revision === version) update({ session: null, loading: false, error: 'Your session could not be restored. Please log in again.' })
   }
  })
  return latestVerification
 }
 const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
  if (active && event !== 'INITIAL_SESSION') { void accept(session) }
 })
 const initialRevision = revision
 const ready = (async () => {
  try {
   const { data, error } = await client.auth.getSession()
   if (!active) return
   if (revision !== initialRevision) { await latestVerification; return }
   if (error) throw error
   await accept(data.session)
  } catch {
   if (active && revision === initialRevision) update({ session: null, loading: false, error: 'Your session could not be restored. Please log in again.' })
  }
 })()
 return { ready, unsubscribe: () => { active = false; subscription.unsubscribe() } }
}
