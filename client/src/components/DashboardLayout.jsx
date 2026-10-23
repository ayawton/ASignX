import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, Camera, Gamepad2, Hand, LayoutDashboard, LogOut, Trophy, UserRound } from 'lucide-react'
import { useAuth } from '../auth'
import '../pages/Dashboard.css'

export default function DashboardLayout() {
 const { logout } = useAuth()
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
 return <div className="dashboard-workspace">
  <header className="dashboard-header"><Link to="/dashboard" aria-label="ASignX dashboard"><img src="/branding/asignx-horizontal-color.svg" alt="ASignX" width="160" height="47" /></Link><span>Your learning space</span><Link to="/dashboard/profile"><UserRound size={18} /> Your account</Link></header>
  <div className="container learner-dashboard">
   <aside className="learner-sidebar" aria-label="Your workspace">
    <span className="learner-workspace"><Hand size={20} /> Your workspace</span>
    <nav aria-label="Dashboard navigation">
     <NavLink to="/dashboard" end><LayoutDashboard size={18} /> Overview</NavLink>
     <NavLink to="/dashboard/live"><Camera size={18} /> ASignLive</NavLink>
     <NavLink to="/dashboard/learn" end><BookOpen size={18} /> ASign Learn</NavLink>
     <NavLink to="/dashboard/learn/arcade"><Gamepad2 size={18} /> Sign Strike</NavLink>
     <NavLink to="/dashboard/progress"><Trophy size={18} /> My progress</NavLink>
     <NavLink to="/dashboard/profile"><UserRound size={18} /> My profile</NavLink>
    </nav>
    <div className="learner-sidebar-note"><Hand size={25} /><p>A little practice.<br />More ways to connect.</p></div>
    {error && <p role="alert">{error}</p>}
    <button type="button" onClick={leave} disabled={busy}><LogOut size={17} />{busy ? 'Logging out…' : 'Log out'}</button>
   </aside>
   <div className="dashboard-page-content"><Outlet /></div>
  </div>
 </div>
}
