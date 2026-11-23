const storageKey = 'asignx.guest'
let token
let start

export function guestToken() {
 if (token !== undefined) return token
 try { return sessionStorage.getItem(storageKey) } catch { return null }
}

function saveToken(value) {
 token = value
 try {
  if (value) sessionStorage.setItem(storageKey, value)
  else sessionStorage.removeItem(storageKey)
 } catch { /* A guest can still play until the page reloads. */ }
}

export function expireGuest(expected) {
 if (expected !== guestToken()) return
 saveToken(null)
 window.dispatchEvent(new Event('asignx:guest-ended'))
}

export async function restoreGuest() {
 const existing = guestToken()
 if (!existing) return null
 const response = await fetch('/api/guest/session', { headers: { Authorization: `Bearer ${existing}` } })
 if (response.status === 401) { expireGuest(existing); return null }
 if (!response.ok) throw new Error('Could not restore your guest session. Try again.')
 return response.json()
}

export function startGuest() {
 start ??= (async () => {
  const response = await fetch('/api/guest', { method: 'POST' })
  if (!response.ok) throw new Error(response.status === 429 ? 'Guest sign-in is busy. Try again shortly.' : 'Guest sign-in is temporarily unavailable.')
  const session = await response.json()
  saveToken(session.token)
  return session.user
 })().finally(() => { start = undefined })
 return start
}

export async function endGuest() {
 const existing = guestToken()
 if (!existing) return
 const response = await fetch('/api/guest/session', { method: 'DELETE', headers: { Authorization: `Bearer ${existing}` } })
 if (!response.ok) throw new Error('Could not end your guest session. Try again.')
 expireGuest(existing)
}
