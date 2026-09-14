import { Hand } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Logo({ light = false }) {
  return <Link to="/" className={`logo ${light ? 'logo--light' : ''}`} aria-label="ASign home">
    <span className="logo__mark"><Hand size={22} strokeWidth={2.4} /></span>
    <span>ASign</span>
  </Link>
}
