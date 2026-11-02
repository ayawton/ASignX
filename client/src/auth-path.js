/** Only return to a page within ASignX after authentication. */
export function internalPath(value) {
 if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || [...value].some(c => c.charCodeAt(0) <= 32)) return '/dashboard'
 const path = new URL(value, 'https://asignx.internal')
 return path.origin === 'https://asignx.internal' && !/^\/(login|register|auth|reset-password|forgot-password)(\/|$)/.test(path.pathname) ? path.pathname + path.search + path.hash : '/dashboard'
}

/** Resolve workspace destinations only after the current account's role is verified. */
export function workspaceDestination(pathname, isAdmin) {
 const adminPage = pathname === '/dashboard/admin' || pathname.startsWith('/dashboard/admin/')
 if (!isAdmin && adminPage) return '/dashboard'
 if (isAdmin && !adminPage && pathname !== '/dashboard/profile') return '/dashboard/admin'
 return null
}
