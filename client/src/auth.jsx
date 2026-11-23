/* eslint-disable react/only-export-components -- Shared authentication context and its helpers form one module. */
import { createContext, Fragment, useCallback, useContext, useEffect, useState } from 'react'
import { observeSession } from './login'
import { endGuest, expireGuest, guestToken, restoreGuest, startGuest } from './guest'
import { createClient } from '@supabase/supabase-js'
import { Navigate, useLocation } from 'react-router-dom'
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: typeof window === 'undefined' || window.location.pathname !== '/auth/callback' } }) : null
const Context = createContext(null)
export { internalPath } from './auth-path'
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [guest, setGuest] = useState(null)
  const [restoringGuest, setRestoringGuest] = useState(() => Boolean(guestToken()))
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState('')
  useEffect(() => {
    if (!supabase) return
    const observer = observeSession(supabase, state => {
      setSession(state.session); setError(state.error); setLoading(state.loading)
      if (state.session) {
        setGuest(null)
        setRestoringGuest(false)
        void endGuest().catch(() => {})
      }
    })
    return observer.unsubscribe
  }, [])
  useEffect(() => {
    if (loading || session || !guestToken()) return
    let active = true
    restoreGuest().then(user => { if (active) setGuest(user) })
      .catch(failure => { if (active) setError(failure.message) })
      .finally(() => { if (active) setRestoringGuest(false) })
    return () => { active = false }
  }, [loading, session])
  useEffect(() => {
    function expired() { setGuest(null) }
    window.addEventListener('asignx:guest-ended', expired)
    return () => window.removeEventListener('asignx:guest-ended', expired)
  }, [])
  const enterGuest = useCallback(async () => {
    if (session || guest) return
    setGuest(await startGuest())
  }, [session, guest])
  async function logout() {
    if (!session && guest) { await endGuest(); setGuest(null); return }
    if (!supabase) return
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) throw error
    setSession(null); setError('')
  }
  return <Context.Provider value={{ session, user: session?.user ?? guest, loading: loading || restoringGuest, error, enterGuest, logout }}>{children}</Context.Provider>
}
export const useAuth = () => useContext(Context)
export function Protected({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <p className="container studio-section" role="status">Restoring your account…</p>
  return user && (user.email_confirmed_at || user.role === 'guest') ? <Fragment key={user.id}>{children}</Fragment> : <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
}
export async function accountHeaders(initial) {
  const headers = new Headers(initial)
  const { data } = supabase ? await supabase.auth.getSession() : { data: {} }
  const token = data.session && data.session.user?.is_anonymous !== true ? data.session.access_token : guestToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
}
export async function api(path, options = {}) {
  const headers = await accountHeaders(options.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(`/api${path}`, { ...options, headers })
  const body = await response.json()
  if (response.status === 401 && headers.get('Authorization')?.startsWith('Bearer guest.')) {
    expireGuest(headers.get('Authorization').slice(7))
  }
  if (!response.ok) throw new Error(body.error || 'Unable to complete the request.')
  return body
}

