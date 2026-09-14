import { Link } from 'react-router-dom'

export default function Button({ to, variant = 'primary', className = '', children, ...props }) {
  const classes = `button button--${variant} ${className}`.trim()
  return to ? <Link to={to} className={classes} {...props}>{children}</Link> : <button className={classes} {...props}>{children}</button>
}
