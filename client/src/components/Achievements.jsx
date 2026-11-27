import { BookOpen, ClipboardCheck, Flame, Trophy, Zap, HelpCircle } from 'lucide-react'
import './Achievements.css'
import BadgeSvg from './BadgeSvg'
import { badgeTiers } from '../data/badge-design'

export const achievementMetrics = {
 completed_lessons: 'Lessons completed',
 successful_practices: 'Successful Practice rounds',
 total_xp: 'XP earned',
 streak_days: 'Streak days',
 perfect_lessons: 'Different lessons with perfect runs',
 completed_courses: 'Courses completed',
}
export const badgeIcons = { lesson: BookOpen, practice: ClipboardCheck, xp: Zap, streak: Flame, trophy: Trophy }
export const statusLabels = { draft: 'Draft', published: 'Published', retired: 'Retired' }

export function BadgeArt({ badge }) {
 const Icon = badge.hidden ? HelpCircle : badgeIcons[badge.icon] ?? Trophy
 if (!badge.hidden && badge.badge_design) return <span className="badge-art is-designed"><BadgeSvg badge={badge} /></span>
 return <span className={`badge-art badge-art-${badge.hidden ? 'secret' : badge.icon || 'trophy'}`}><Icon size={44} strokeWidth={1.5} aria-hidden="true" /></span>
}

export function BadgeCard({ badge, preview = false }) {
 const earned = Boolean(badge.unlocked_at)
 const progress = earned ? badge.threshold : Math.min(badge.progress ?? 0, badge.threshold)
 return <li className={`collection-card ${earned ? 'is-earned' : ''}`}>
  <BadgeArt badge={badge} />
  <h3>{badge.name || 'Achievement name'}</h3><p>{badge.description || 'Badge description'}</p>
  {!badge.hidden && <span className="badge-tier">{badgeTiers[badge.tier || 'starter']}</span>}
  <div className="badge-progress">
   {earned ? <span>Earned <time dateTime={badge.unlocked_at}>{new Date(badge.unlocked_at).toLocaleDateString()}</time></span> :
    badge.hidden ? <span>Secret until earned</span> :
    <><span>{progress} / {badge.threshold} {achievementMetrics[badge.metric]?.toLowerCase()}</span>
    {!preview && <progress aria-label={badge.name} value={progress} max={badge.threshold} />}</>}
  </div>
 </li>
}

export function BadgeCollection({ badges }) {
 const [secrets, visible] = [badges.filter(b => b.hidden), badges.filter(b => !b.hidden)]
 const groups = new Map()
 for (const badge of visible) {
  const key = JSON.stringify([badge.metric, badge.milestone_group || null])
  if (!groups.has(key)) groups.set(key, { title: badge.milestone_group || achievementMetrics[badge.metric], badges: [] })
  groups.get(key).badges.push(badge)
 }
 const families = [...groups.values()]
 families.forEach(group => { if (group.badges[0].milestone_group) group.badges.sort((a, b) => a.threshold - b.threshold) })
 if (secrets.length) families.push({ title: 'Discoveries', badges: secrets })
 return <div className="milestone-shelves">{families.map(group => <section key={group.title}>
  <h3>{group.title}</h3><ul className="collection-grid">{group.badges.map(badge => <BadgeCard key={badge.id} badge={badge} />)}</ul>
 </section>)}</div>
}
