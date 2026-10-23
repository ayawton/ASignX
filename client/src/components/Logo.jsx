import { Link } from 'react-router-dom'

export default function Logo({ light = false, className = '' }) {
  return <Link to="/" className={`brand ${className}`.trim()} aria-label="ASignX home">
    <img className="brand-image" src={`/branding/asignx-horizontal-${light ? 'reverse' : 'color'}.svg`} alt="ASignX" width="1869" height="545" decoding="async" />
  </Link>
}
