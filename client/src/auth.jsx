/* eslint-disable react/only-export-components -- Shared authentication context and its helpers form one module. */
import { createContext, useContext, useEffect, useState } from 'react'
import { observeSession } from './login'
import { createClient } from '@supabase/supabase-js'
import { Navigate, useLocation } from 'react-router-dom'
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: typeof window === 'undefined' || window.location.pathname !== '/auth/callback' } }) : null
const Context = createContext(null)
export { internalPath } from './auth-path'
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState('')
  useEffect(() => {
    if (!supabase) return
    const observer = observeSession(supabase, state => {
      setSession(state.session); setError(state.error); setLoading(state.loading)
    })
    return observer.unsubscribe
  }, [])
  async function logout() { if (!supabase) return; const { error } = await supabase.auth.signOut({ scope: 'local' }); if (error) throw error; setSession(null); setError('') }
  return <Context.Provider value={{ session, user: session?.user, loading, error, logout }}>{children}</Context.Provider>
}
export const useAuth = () => useContext(Context)
export function Protected({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <p className="container studio-section" role="status">Restoring your account…</p>
  return user?.email_confirmed_at ? children : <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
}
export async function api(path, options = {}) {
  const { data } = supabase ? await supabase.auth.getSession() : { data: {} }
  const response = await fetch(`/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}), ...options.headers } })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || 'Unable to complete the request.')
  return body
}

