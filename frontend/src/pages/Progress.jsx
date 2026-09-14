import { Award, BookOpenCheck, Flame, Medal, Sparkles, Star, Target, Trophy, Zap } from 'lucide-react'
import Button from '../components/Button'
import { AchievementCard, StatCard } from '../components/Cards'
import PageHeader from '../components/PageHeader'
import ProgressBar from '../components/ProgressBar'
import { mastery } from '../data/mockData'

const achievements = [
  { title: 'First Lesson', detail: 'Complete one lesson', icon: Medal, unlocked: true },
  { title: '5 Day Streak', detail: 'Practice five days in a row', icon: Flame, unlocked: true },
  { title: '100 XP', detail: 'Earn your first 100 XP', icon: Zap, unlocked: true },
  { title: 'Alphabet Master', detail: 'Master every letter', icon: Star, unlocked: false },
  { title: 'Practice Champion', detail: 'Complete 25 practices', icon: Trophy, unlocked: false },
]
const week = [{ day: 'Mon', value: 35 }, { day: 'Tue', value: 70 }, { day: 'Wed', value: 48 }, { day: 'Thu', value: 90 }, { day: 'Fri', value: 62 }, { day: 'Sat', value: 100 }, { day: 'Sun', value: 42 }]

export default function Progress() {
  return <>
    <PageHeader eyebrow="Your progress" title="Small wins become real fluency" description="See what you’ve learned, celebrate your consistency, and focus your next practice where it matters most." />
    <section className="section section--compact"><div className="shell">
      <div className="stat-grid stat-grid--six"><StatCard icon={Zap} label="Total XP" value="860" tone="amber" /><StatCard icon={Flame} label="Streak" value="7 days" tone="coral" /><StatCard icon={BookOpenCheck} label="Lessons" value="14" tone="blue" /><StatCard icon={Target} label="Signs learned" value="38" tone="blue" /></div>
      <article className="level-progress"><div className="level-progress__badge">4</div><div><div className="level-progress__meta"><div><small>Current level</small><h2>Confident Beginner</h2></div><span>66% overall</span></div><ProgressBar value={66} showValue={false} /><p>Earn 340 more XP to reach <strong>Level 5 · Everyday Signer</strong></p></div></article>
      <div className="progress-layout">
        <article className="content-card mastery-card"><div className="panel-heading"><div><span className="mini-label">Skill detail</span><h2>Sign mastery</h2></div><Award /></div><div className="mastery-list">{mastery.map(item => <ProgressBar key={item.label} label={item.label} value={item.value} tone={item.value < 70 ? 'coral' : 'blue'} />)}</div></article>
        <article className="content-card practice-card"><span className="mini-label">Recommended practice</span><h2>Strengthen these signs</h2><p>A few focused repetitions will improve your confidence.</p>{mastery.filter(x => x.value < 70).map(item => <div className="practice-sign" key={item.label}><span>{item.label.slice(0, 1)}</span><div><strong>{item.label}</strong><small>{item.value}% mastery</small></div><Button to="/learn/lesson/3" variant="text">Practice</Button></div>)}</article>
      </div>
      <div className="progress-layout progress-layout--wide">
        <article className="content-card weekly-chart"><div className="panel-heading"><div><span className="mini-label">Last 7 days</span><h2>Weekly activity</h2></div><span className="trend">↑ 18% this week</span></div><div className="chart" aria-label="Weekly activity chart">{week.map(item => <div className="chart__column" key={item.day}><div className="chart__track"><i style={{ height: `${item.value}%` }}><span>{item.value} XP</span></i></div><small>{item.day}</small></div>)}</div></article>
        <article className="content-card consistency"><span><Sparkles /></span><h2>You’re building a habit</h2><p>You practiced on 5 of the last 7 days. Two more active days will set a new personal best.</p><Button to="/learn/courses" variant="secondary">Keep learning</Button></article>
      </div>
      <div className="section-heading"><span className="eyebrow">Your collection</span><h2>Achievements</h2><p>Unlocked badges stay bright; keep learning to reveal the rest.</p></div><div className="achievement-grid">{achievements.map(item => <AchievementCard item={item} key={item.title} />)}</div>
    </div></section>
  </>
}
