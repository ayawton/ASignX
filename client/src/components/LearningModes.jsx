import { BookOpen, Crosshair, ArrowUpRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import './LearningModes.css'

export default function LearningModes() {
  const { pathname } = useLocation()
  const arcade = pathname.startsWith('/learn/arcade')
  return <nav className="learning-modes" aria-label="Learning experiences">
    <Link to="/learn" className={`learning-mode${!arcade ? ' is-current' : ''}`} aria-current={!arcade ? 'page' : undefined}>
      <span className="learning-mode-icon"><BookOpen size={21} /></span>
      <span><strong>Learning modules</strong><small>A little guidance, one sign at a time.</small></span>
      <ArrowUpRight size={17} />
    </Link>
    <Link to="/learn/arcade" className={`learning-mode learning-mode-game${arcade ? ' is-current' : ''}`} aria-current={arcade ? 'page' : undefined}>
      <span className="learning-mode-icon"><Crosshair size={21} /></span>
      <span><strong>Sign Strike <span className="learning-mode-tag">Arcade</span></strong><small>Sign the letters. Clear the skies.</small></span>
      <ArrowUpRight size={17} />
    </Link>
  </nav>
}
