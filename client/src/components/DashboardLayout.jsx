import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, Camera, Gamepad2, Hand, LayoutDashboard, LogOut, Trophy, UserRound } from 'lucide-react'
import { api, useAuth } from '../auth'
import '../pages/Dashboard.css'

export default function DashboardLayout() {
 const { logout, user } = useAuth()
 const [adminId, setAdminId] = useState(null)
 const [resolvedId, setResolvedId] = useState(null)
 const [profileError, setProfileError] = useState('')
 const [retry, setRetry] = useState(0)
 useEffect(() => {
  let active = true
  if (user) api('/me/profile').then(profile => { if (active) { setAdminId(profile.role === 'admin' ? user.id : null); setResolvedId(user.id); setProfileError('') } }).catch(error => { if (active) setProfileError(error.message) })
  return () => { active = false }
 }, [user, retry])
 const navigate = useNavigate()
 const { pathname } = useLocation()
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState('')
 useEffect(() => { window.scrollTo(0, 0) }, [pathname])
 async function leave() {
  setBusy(true); setError('')
  try { await logout(); navigate('/', { replace: true }) }
  catch (failure) { setError(failure.message); setBusy(false) }
 }
 const isAdmin = Boolean(user && adminId === user.id)
 if (user && resolvedId !== user.id) return <section className="container studio-section">{profileError ? <><p role="alert">{profileError}</p><button className="btn" onClick={() => { setProfileError(''); setRetry(value => value+1) }}>Try again</button><button className="text-link" disabled={busy} onClick={leave}>Log out</button>{error && <p role="alert">{error}</p>}</> : <p role="status">Loading your workspace…</p>}</section>
 if (isAdmin && pathname !== '/dashboard/profile' && pathname !== '/dashboard/admin' && !pathname.startsWith('/dashboard/admin/')) return <Navigate to="/dashboard/admin" replace />
 return <div className="dashboard-workspace">
  <header className="dashboard-header"><Link to={isAdmin ? '/dashboard/admin' : '/dashboard'} aria-label="ASignX dashboard"><img src="/branding/asignx-horizontal-color.svg" alt="ASignX" width="160" height="47" /></Link><span>{isAdmin ? 'Administration' : 'Your learning space'}</span><Link to="/dashboard/profile"><UserRound size={18} /> Your account</Link></header>
  <div className="container learner-dashboard">
   <aside className="learner-sidebar" aria-label="Your workspace">
    <span className="learner-workspace"><Hand size={20} /> {isAdmin ? 'Admin workspace' : 'Your workspace'}</span>
    <nav aria-label="Dashboard navigation">
     {!isAdmin && <><NavLink to="/dashboard" end><LayoutDashboard size={18} /> Overview</NavLink>
     <NavLink to="/dashboard/live"><Camera size={18} /> ASignLive</NavLink>
     <NavLink to="/dashboard/learn" end><BookOpen size={18} /> ASign Learn</NavLink>
     <NavLink to="/dashboard/learn/arcade"><Gamepad2 size={18} /> Sign Strike</NavLink>
     <NavLink to="/dashboard/progress"><Trophy size={18} /> My progress</NavLink></>}
     <NavLink to="/dashboard/profile"><UserRound size={18} /> My profile</NavLink>
     {isAdmin && <><NavLink to="/dashboard/admin" end><LayoutDashboard size={18} /> Overview</NavLink><NavLink to="/dashboard/admin/courses"><BookOpen size={18} /> Manage courses</NavLink></>}
    </nav>
    {error && <p role="alert">{error}</p>}
    <button type="button" onClick={leave} disabled={busy}><LogOut size={17} />{busy ? 'Logging out…' : 'Log out'}</button>
   </aside>
   <div className="dashboard-page-content"><Outlet /></div>
  </div>
 </div>
}
