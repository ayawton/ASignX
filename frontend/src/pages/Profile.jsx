import { useState } from 'react'
import { Award, Camera, CheckCircle2, Flame, Medal, Pencil, Save, ShieldCheck, Sparkles, Star, Trophy, UserRound, Zap } from 'lucide-react'
import Button from '../components/Button'
import { AchievementCard, StatCard } from '../components/Cards'
import PageHeader from '../components/PageHeader'

const achievements = [{ title: 'First Lesson', detail: 'Unlocked', icon: Medal, unlocked: true }, { title: '7 Day Streak', detail: 'Unlocked', icon: Flame, unlocked: true }, { title: '100 XP', detail: 'Unlocked', icon: Star, unlocked: true }]

export default function Profile() {
  const [editing, setEditing] = useState(false); const [form, setForm] = useState({ name: 'Alex Morgan', email: 'alex@example.com', goal: '15 minutes a day' }); const [saved, setSaved] = useState(false)
  const save = e => { e.preventDefault(); setEditing(false); setSaved(true); setTimeout(() => setSaved(false), 3500) }
  return <><PageHeader eyebrow="Learner profile" title="Your ASign space" description="Manage your demo profile and see the learning momentum you’ve built." />
    <section className="section section--compact"><div className="shell"><article className="profile-banner"><div className="avatar"><UserRound /><button aria-label="Change profile image" onClick={() => setEditing(true)}><Camera /></button></div><div className="profile-banner__identity"><span className="pill pill--beginner">Level 4 · Confident Beginner</span><h2>{form.name}</h2><p>{form.email}</p></div><Button variant="white" onClick={() => setEditing(!editing)}><Pencil /> {editing ? 'Cancel editing' : 'Edit profile'}</Button></article>
      <div className="stat-grid"><StatCard icon={Zap} label="Total XP" value="860" tone="amber" /><StatCard icon={Flame} label="Current streak" value="7 days" tone="coral" /><StatCard icon={CheckCircle2} label="Lessons done" value="14" tone="blue" /><StatCard icon={Award} label="Achievements" value="3" tone="blue" /></div>
      <div className="profile-grid"><article className="content-card"><div className="panel-heading"><div><span className="mini-label">Account settings</span><h2>Personal information</h2></div><ShieldCheck /></div><form className="settings-form" onSubmit={save}><label>Full name<input value={form.name} disabled={!editing} onChange={e => setForm({ ...form, name: e.target.value })} required /></label><label>Email address<input type="email" value={form.email} disabled={!editing} onChange={e => setForm({ ...form, email: e.target.value })} required /></label><label>Daily learning goal<select value={form.goal} disabled={!editing} onChange={e => setForm({ ...form, goal: e.target.value })}><option>5 minutes a day</option><option>15 minutes a day</option><option>30 minutes a day</option></select></label>{editing && <Button type="submit"><Save /> Save local changes</Button>}{saved && <div className="form-message"><CheckCircle2 /> Profile updated locally.</div>}<p className="data-note"><ShieldCheck /> Demo data is stored only in React state and is not saved to a database.</p></form></article>
        <article className="content-card"><span className="mini-label">Recent badges</span><h2>Achievements</h2><div className="achievement-stack">{achievements.map(a => <AchievementCard item={a} compact key={a.title} />)}</div><Button to="/progress" variant="secondary" className="full">View all progress</Button></article></div>
    </div></section></>
}
