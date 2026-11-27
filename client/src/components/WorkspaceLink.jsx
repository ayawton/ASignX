import { Link, useLocation } from 'react-router-dom'

// Shared learning screens keep navigation inside the signed-in workspace.
export default function WorkspaceLink({ to, ...props }) {
 const { pathname } = useLocation()
 const destination = pathname.startsWith('/dashboard') && typeof to === 'string' && /^\/(learn|live|profile|progress)(\/|\?|#|$)/.test(to) ? `/dashboard${to}` : to
 return <Link to={destination} {...props} />
}
