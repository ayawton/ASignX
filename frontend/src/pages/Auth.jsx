import { useState } from 'react'
import { ArrowRight, CheckCircle2, Eye, EyeOff, Hand, LockKeyhole, Mail, ShieldCheck, User } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from '../components/Button'
import Logo from '../components/Logo'

function Field({ label, name, type = 'text', icon: Icon, value, onChange, error, autoComplete, toggle, onToggle }) {
  return <label className={`form-field ${error ? 'has-error' : ''}`}><span>{label}</span><div><Icon /><input name={name} type={type} value={value} onChange={onChange} autoComplete={autoComplete} aria-invalid={!!error} />{toggle && <button type="button" onClick={onToggle} aria-label={type === 'password' ? 'Show password' : 'Hide password'}>{type === 'password' ? <Eye /> : <EyeOff />}</button>}</div>{error && <small>{error}</small>}</label>
}

export function Login() {
  const [form, setForm] = useState({ email: '', password: '', remember: false }); const [errors, setErrors] = useState({}); const [show, setShow] = useState(false); const [message, setMessage] = useState('')
  const change = e => { const { name, value, checked, type } = e.target; setForm({ ...form, [name]: type === 'checkbox' ? checked : value }); setErrors({ ...errors, [name]: '' }); setMessage('') }
  const submit = e => { e.preventDefault(); const next = {}; if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email address.'; if (form.password.length < 6) next.password = 'Password must be at least 6 characters.'; setErrors(next); if (!Object.keys(next).length) setMessage('Demo mode: authentication backend is not connected yet.') }
  return <AuthShell title="Welcome back" subtitle="Continue building your ASL skills." aside="Your next conversation begins with one more sign.">
    <form onSubmit={submit} noValidate><Field label="Email address" name="email" type="email" icon={Mail} value={form.email} onChange={change} error={errors.email} autoComplete="email" /><Field label="Password" name="password" type={show ? 'text' : 'password'} icon={LockKeyhole} value={form.password} onChange={change} error={errors.password} autoComplete="current-password" toggle onToggle={() => setShow(!show)} />
      <div className="form-row"><label className="checkbox"><input type="checkbox" name="remember" checked={form.remember} onChange={change} /><span /> Remember me</label><button type="button" className="text-action" onClick={() => setMessage('Demo mode: password recovery requires backend integration.')}>Forgot password?</button></div>
      <Button type="submit" className="full">Sign in <ArrowRight /></Button>{message && <div className="form-message"><CheckCircle2 />{message}</div>}
    </form><p className="auth-switch">New to ASign? <Link to="/register">Create an account</Link></p>
  </AuthShell>
}

export function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' }); const [errors, setErrors] = useState({}); const [show, setShow] = useState(false); const [message, setMessage] = useState('')
  const change = e => { setForm({ ...form, [e.target.name]: e.target.value }); setErrors({ ...errors, [e.target.name]: '' }); setMessage('') }
  const submit = e => { e.preventDefault(); const next = {}; if (form.name.trim().length < 2) next.name = 'Enter your full name.'; if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email address.'; if (form.password.length < 8) next.password = 'Use at least 8 characters.'; if (form.confirm !== form.password) next.confirm = 'Passwords do not match.'; setErrors(next); if (!Object.keys(next).length) setMessage('Demo mode: account creation requires backend integration.') }
  return <AuthShell title="Start your journey" subtitle="Create a demo profile and explore ASign." aside="Learn with intention. Communicate with confidence.">
    <form onSubmit={submit} noValidate><Field label="Full name" name="name" icon={User} value={form.name} onChange={change} error={errors.name} autoComplete="name" /><Field label="Email address" name="email" type="email" icon={Mail} value={form.email} onChange={change} error={errors.email} autoComplete="email" /><Field label="Password" name="password" type={show ? 'text' : 'password'} icon={LockKeyhole} value={form.password} onChange={change} error={errors.password} autoComplete="new-password" toggle onToggle={() => setShow(!show)} /><Field label="Confirm password" name="confirm" type={show ? 'text' : 'password'} icon={ShieldCheck} value={form.confirm} onChange={change} error={errors.confirm} autoComplete="new-password" />
      <Button type="submit" className="full">Create demo account <ArrowRight /></Button>{message && <div className="form-message"><CheckCircle2 />{message}</div>}
    </form><p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
  </AuthShell>
}

function AuthShell({ title, subtitle, aside, children }) {
  return <section className="auth-page"><div className="auth-shell"><aside className="auth-aside"><Logo light /><div className="auth-aside__graphic"><span><Hand /></span><i /><i /><i /></div><div><span className="eyebrow eyebrow--light">ASL for everyone</span><h2>{aside}</h2><p>A polished frontend preview of the future ASign experience.</p></div></aside><div className="auth-card"><div className="auth-mobile-logo"><Logo /></div><span className="mini-label">ASign account</span><h1>{title}</h1><p>{subtitle}</p>{children}</div></div></section>
}
