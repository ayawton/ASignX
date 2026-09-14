import { ArrowRight, LockKeyhole } from 'lucide-react'
import Button from './Button'
import ProgressBar from './ProgressBar'

export function FeatureCard({ icon: Icon, eyebrow, title, description, to, action, tone = 'blue' }) {
  return <article className={`feature-card feature-card--${tone}`}>
    <div className="icon-box"><Icon /></div><span className="mini-label">{eyebrow}</span><h3>{title}</h3><p>{description}</p>
    <Button to={to} variant="text">{action} <ArrowRight size={17} /></Button>
  </article>
}

export function StatCard({ icon: Icon, label, value, note, tone = 'blue' }) {
  return <article className="stat-card"><span className={`stat-card__icon bg-${tone}`}><Icon /></span><div><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div></article>
}

export function CourseCard({ course, level }) {
  return <article className={`course-card ${course.locked ? 'is-locked' : ''}`}>
    <div className="course-card__top"><span className={`pill pill--${level.toLowerCase()}`}>{level}</span>{course.locked && <span className="lock"><LockKeyhole size={15} /> Locked</span>}</div>
    <h3>{course.title}</h3><p>{course.description}</p><span className="course-card__lessons">{course.lessons} bite-sized lessons</span>
    <ProgressBar value={course.progress} label="Course progress" />
    {course.locked ? <button className="button button--disabled" disabled><LockKeyhole size={16} /> Complete earlier courses</button> : <Button to={`/learn/lesson/${course.id}`} variant="secondary">{course.progress ? 'Continue course' : 'Start course'} <ArrowRight size={16} /></Button>}
  </article>
}

export function AchievementCard({ item, compact = false }) {
  const Icon = item.icon
  return <article className={`achievement ${item.unlocked ? 'is-unlocked' : 'is-locked'} ${compact ? 'achievement--compact' : ''}`}>
    <div className="achievement__icon"><Icon /></div><div><h3>{item.title}</h3><p>{item.detail}</p></div>{!item.unlocked && <LockKeyhole className="achievement__lock" size={16} />}
  </article>
}
