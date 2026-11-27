import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Link from '../components/WorkspaceLink'
import { api, useAuth } from '../auth'
import { BadgeCard } from '../components/Achievements'

export default function Profile() {
 const [profile, setProfile] = useState(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
 const { logout } = useAuth(), navigate = useNavigate()
 const [badges, setBadges] = useState(null), [badgeError, setBadgeError] = useState('')
 const [badgeRetry, setBadgeRetry] = useState(0)
 useEffect(() => {
  let active = true
  api('/me/profile').then(data => { if (active) setProfile(data) }).catch(e => { if (active) setMessage(e.message) })
  return () => { active = false }
 }, [])
 const profileId = profile?.id, profileRole = profile?.role
 useEffect(() => {
  if (!profileId || profileRole === 'admin') return
  let active = true
  api('/me/progress').then(data => { if (active) setBadges(data.achievements.slice(0, 3)) })
   .catch(() => { if (active) setBadgeError('Unable to load your badges.') })
  return () => { active = false }
 }, [profileId, profileRole, badgeRetry])
 async function save(e) {
  e.preventDefault(); setBusy(true)
  try {
   setProfile(await api('/me/profile', { method: 'PATCH', body: JSON.stringify({ display_name: profile.display_name, timezone: profile.timezone }) }))
   setMessage('Your account profile is saved.')
  } catch (e) { setMessage(e.message) }
  finally { setBusy(false) }
 }
 async function leave() {
  setBusy(true)
  try { await logout(); navigate('/', { replace: true }) }
  catch (e) { setMessage(e.message) }
  finally { setBusy(false) }
 }
 return <section className="container studio-section studio-page achievement-page">
  <div className="page-heading"><div><h1>Your profile</h1><p>{profileRole === 'guest' ? 'Your details and badges last for this guest session.' : 'Your details are saved to your authenticated account.'}</p></div></div>
  {message && <p role="status">{message}</p>}
  {profile ? <form className="studio-profile-form" onSubmit={save}>
   <label>Display name<input required maxLength={100} value={profile.display_name} onChange={e => setProfile({ ...profile, display_name: e.target.value })} /></label>
   <label>Email address<input disabled value={profile.email || ''} /></label>
   <label>Time zone<input required maxLength={64} placeholder="Asia/Manila" value={profile.timezone} onChange={e => setProfile({ ...profile, timezone: e.target.value })} /></label>
   <button className="btn" disabled={busy}>Save changes</button>
  </form> : !message && <p role="status">Loading your profile.</p>}
  {profile && profileRole !== 'admin' && <section className="profile-badges"><h2>Recent achievements</h2>
   {badgeError ? <p role="alert">{badgeError} <button className="text-link" onClick={() => { setBadgeError(''); setBadgeRetry(value => value + 1) }}>Retry</button></p> : badges === null ? <p role="status">Loading your badges.</p> : badges.length ? <ul className="collection-grid">{badges.map(badge => <BadgeCard key={badge.id} badge={badge} />)}</ul> : <p>Your earned badges will appear here.</p>}
   <Link className="text-link" to="/progress#achievements">View your collection</Link>
  </section>}
  <button type="button" className="btn btn-secondary" disabled={busy} onClick={leave}>Log out</button>
 </section>
}
