import { ArrowRight, BookOpen, CheckCircle2, Flame, LockKeyhole, Medal, Play, Sparkles, Target, Trophy, Zap } from 'lucide-react'
import Button from '../components/Button'
import { AchievementCard, StatCard } from '../components/Cards'
import ProgressBar from '../components/ProgressBar'
import { categories } from '../data/mockData'

const achievements = [
  { title: 'First Steps', detail: 'Completed your first lesson', icon: Medal, unlocked: true },
  { title: 'On Fire', detail: 'Maintain a 7 day streak', icon: Flame, unlocked: true },
  { title: 'Word Collector', detail: 'Learn 25 signs', icon: Trophy, unlocked: false },
]

export default function Learn() {
  return <>
    <section className="learn-hero"><div className="shell learn-hero__grid">
      <div><span className="eyebrow"><Sparkles size={15} /> ASign Learn</span><h1>Good afternoon, Alex! <span>👋</span></h1><p>Every sign you learn opens another door. Ready for today’s practice?</p></div>
      <div className="level-chip"><div className="level-chip__ring">4</div><div><small>Current level</small><strong>Confident Beginner</strong><span>340 XP to Level 5</span></div></div>
    </div></section>
    <section className="section section--compact"><div className="shell">
      <div className="stat-grid"><StatCard icon={Zap} label="Total XP" value="860" note="+120 this week" tone="amber" /><StatCard icon={Flame} label="Current streak" value="7 days" note="Personal best: 12" tone="coral" /><StatCard icon={CheckCircle2} label="Lessons done" value="14" note="3 this week" tone="blue" /><StatCard icon={Target} label="Signs learned" value="38" note="12 nearly mastered" tone="blue" /></div>
      <div className="dashboard-grid">
        <article className="continue-card"><div className="continue-card__copy"><span className="mini-label">Pick up where you left off</span><h2>Friendly Greetings</h2><p>Lesson 3 · Greeting someone new</p><ProgressBar value={42} label="Unit progress" /><Button to="/learn/lesson/2">Continue learning <Play size={16} fill="currentColor" /></Button></div><div className="continue-card__art"><div className="orbit-sign"><span>HELLO</span><Sparkles /></div></div></article>
        <article className="recommended-card"><span className="mini-label">Recommended next</span><div className="recommended-card__icon"><BookOpen /></div><h3>Everyday Essentials</h3><p>Learn “please,” “thank you,” and other signs you’ll use every day.</p><div className="lesson-meta"><span>8 min</span><span>+40 XP</span><span>Beginner</span></div><Button to="/learn/lesson/3" variant="secondary" className="full">Preview lesson <ArrowRight size={16} /></Button></article>
      </div>

      <div className="section-heading section-heading--row"><div><span className="eyebrow">Choose a focus</span><h2>Explore categories</h2></div><Button to="/learn/courses" variant="text">View all courses <ArrowRight size={16} /></Button></div>
      <div className="category-grid">{categories.map(({ title, icon: Icon, color, description, lessonId, locked }) => <article className={`category-card category-card--${color} ${locked ? 'is-locked' : ''}`} key={title}><div className="category-card__icon"><Icon /></div><div><h3>{title}</h3><p>{description}</p></div>{locked ? <LockKeyhole className="category-card__action" /> : <Button to={`/learn/lesson/${lessonId}`} variant="circle" aria-label={`Open ${title}`}><ArrowRight /></Button>}</article>)}</div>

      <div className="dashboard-bottom">
        <div><div className="section-heading section-heading--row"><div><span className="eyebrow">Milestones</span><h2>Recent achievements</h2></div><Button to="/progress" variant="text">See progress <ArrowRight size={16} /></Button></div><div className="achievement-list">{achievements.map(item => <AchievementCard key={item.title} item={item} compact />)}</div></div>
        <aside className="weekly-goal"><div className="weekly-goal__top"><span><Trophy /></span><div><small>Weekly goal</small><strong>4 of 5 lessons</strong></div></div><ProgressBar value={80} showValue={false} tone="amber" /><p>One more lesson to keep your momentum!</p><Button to="/learn/courses" variant="white" className="full">Find a lesson</Button></aside>
      </div>
    </div></section>
  </>
}
