import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import Logo from './Logo'
import Button from './Button'

const links = [['Home', '/'], ['ASignLive', '/live'], ['Learn', '/learn'], ['About', '/about']]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  return <header className="navbar">
    <div className="shell navbar__inner">
      <Logo />
      <button className="navbar__toggle" onClick={() => setOpen(!open)} aria-label="Toggle navigation" aria-expanded={open}>
        {open ? <X /> : <Menu />}
      </button>
      <nav className={`navbar__nav ${open ? 'is-open' : ''}`} aria-label="Main navigation" onClick={() => setOpen(false)}>
        <div className="navbar__links">
          {links.map(([label, to]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'active' : ''}>{label}</NavLink>)}
        </div>
        <div className="navbar__actions">
          <Button to="/login" variant="ghost">Sign in</Button>
          <Button to="/register">Get started</Button>
        </div>
      </nav>
    </div>
  </header>
}
