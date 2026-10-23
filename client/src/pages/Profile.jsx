import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, useAuth } from '../auth'
export default function Profile() {
 const [profile, setProfile] = useState(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
 const { logout } = useAuth(), navigate = useNavigate()
 useEffect(() => { let active = true; api('/me/profile').then(data => { if (active) setProfile(data) }).catch(e => { if (active) setMessage(e.message) }); return () => { active = false } }, [])
 async function save(e) { e.preventDefault(); setBusy(true); try { setProfile(await api('/me/profile', { method: 'PATCH', body: JSON.stringify({ display_name: profile.display_name, timezone: profile.timezone }) })); setMessage('Your account profile is saved.') } catch (e) { setMessage(e.message) } finally { setBusy(false) } }
 async function leave() { setBusy(true); try { await logout(); navigate('/', { replace: true }) } catch (e) { setMessage(e.message) } finally { setBusy(false) } }
 return <section className="container studio-section studio-page"><div className="page-heading"><div><span className="text-label">Your account profile</span><h1>Make yourself at home.</h1><p>Your details are saved to your authenticated account.</p></div></div>{message && <p role="status">{message}</p>}{profile ? <form className="studio-profile-form" onSubmit={save}><label>Display name<input required maxLength={100} value={profile.display_name} onChange={e => setProfile({ ...profile, display_name: e.target.value })} /></label><label>Email address<input disabled value={profile.email || ''} /></label><label>Time zone<input required maxLength={64} placeholder="Asia/Manila" value={profile.timezone} onChange={e => setProfile({ ...profile, timezone: e.target.value })} /></label><button className="btn" disabled={busy}>Save changes</button></form> : !message && <p role="status">Loading your profile…</p>}<p><Link className="text-link" to="/progress">Your account progress</Link></p><button type="button" className="btn btn-secondary" disabled={busy} onClick={leave}>Log out</button></section>
}
