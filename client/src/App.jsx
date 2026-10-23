import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import { AuthCallback, ForgotPassword, ResetPassword, Login, Register } from './pages/Auth'
import Lesson from './pages/Lesson'
import Live from './pages/Live'
import Arcade from './pages/Arcade'
import Profile from './pages/Profile'
import Progress from './pages/Progress'
import Dashboard from './pages/Dashboard'
import DashboardLayout from './components/DashboardLayout'
import { Home, Learn, Courses, About, NotFound } from './Studio'
import { Brand, Button } from './components/StudioKit'
import './studio.css'
import './simple.css'
import { Protected, useAuth } from './auth'
function Header() { const { user } = useAuth(); const [open, setOpen] = useState(false); const { pathname } = useLocation(); useEffect(() => { window.scrollTo(0, 0) }, [pathname]); return <header className="site-header"><div className="container nav"><Brand /><button className="menu-toggle" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="main-navigation" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button><nav id="main-navigation" onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }} className={open ? 'navigation is-open' : 'navigation'} aria-label="Main navigation" onClick={() => setOpen(false)}><div className="nav-links">{user && <NavLink to="/dashboard">Dashboard</NavLink>}<NavLink to="/" end>Home</NavLink><NavLink to="/live">ASignLive <span className="nav-dot" /></NavLink><NavLink to="/learn">ASign Learn</NavLink><NavLink to="/about">Our story</NavLink></div><div className="nav-actions"><Link to={user ? "/dashboard" : "/login"}>{user ? "Your dashboard" : "Log in"}</Link><Button to="/learn">Let’s get signing <ArrowUpRight size={16} /></Button></div></nav></div></header> }
function Footer() { return <footer className="site-footer"><div className="container footer-top"><div><Brand /><p>Learn and practice American Sign Language.</p></div><div><h3>Find your way</h3><Link to="/live">ASignLive</Link><Link to="/learn">ASign Learn</Link><Link to="/learn/courses">All courses</Link><Link to="/learn/arcade">Sign Strike arcade</Link></div><div><h3>Make it yours</h3><Link to="/progress">Your progress</Link><Link to="/profile">Your profile</Link><Link to="/about">About ASignX</Link></div></div><div className="container footer-bottom"><span>© 2026 ASignX. An academic project.</span></div></footer> }
export default function App() {
 const { pathname } = useLocation()
 const workspace = pathname === '/dashboard' || pathname.startsWith('/dashboard/')
 return <><a className="skip-link" href="#main">Skip to content</a>{!workspace && <Header />}<main id="main"><Routes>
  <Route path="/" element={<Home />} />
  <Route path="/learn" element={<Learn />} />
  <Route path="/learn/arcade" element={<Arcade />} />
  <Route path="/learn/courses" element={<Courses />} />
  <Route path="/learn/lesson/:id" element={<Lesson />} />
  <Route path="/live" element={<Live />} />
  <Route path="/dashboard" element={<Protected><DashboardLayout /></Protected>}>
   <Route index element={<Dashboard />} />
   <Route path="live" element={<Live />} />
   <Route path="learn" element={<Learn />} />
   <Route path="learn/courses" element={<Courses />} />
   <Route path="learn/arcade" element={<Arcade />} />
   <Route path="learn/lesson/:id" element={<Lesson />} />
   <Route path="progress" element={<Progress />} />
   <Route path="profile" element={<Profile />} />
   <Route path="*" element={<section className="studio-section"><h1>Page not found</h1><Link className="text-link" to="/dashboard">Back to dashboard</Link></section>} />
  </Route>
  <Route path="/progress" element={<Protected><Progress /></Protected>} />
  <Route path="/profile" element={<Protected><Profile /></Protected>} />
  <Route path="/login" element={<Login />} />
  <Route path="/auth/callback" element={<AuthCallback />} />
  <Route path="/forgot-password" element={<ForgotPassword />} />
  <Route path="/reset-password" element={<ResetPassword />} />
  <Route path="/register" element={<Register />} />
  <Route path="/about" element={<About />} />
  <Route path="*" element={<NotFound />} />
 </Routes></main>{!workspace && <Footer />}</>
}
