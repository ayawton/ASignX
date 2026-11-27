import { BookOpen, ClipboardCheck, Flame, Trophy, Zap } from 'lucide-react'
import './Achievements.css'

export const achievementMetrics = {
 completed_lessons: 'Lessons completed',
 successful_practices: 'Successful Practice rounds',
 total_xp: 'XP earned',
 streak_days: 'Streak days',
}
export const badgeIcons = { lesson: BookOpen, practice: ClipboardCheck, xp: Zap, streak: Flame, trophy: Trophy }

export function BadgeCard({ badge, preview = false }) {
 const Icon = badgeIcons[badge.icon] ?? Trophy
 const earned = Boolean(badge.unlocked_at)
 const progress = earned ? badge.threshold : Math.min(badge.progress ?? 0, badge.threshold)
 return <li className="badge-row">
  <Icon size={22} aria-hidden="true" />
  <div><h3>{badge.name || 'Achievement name'}</h3><p>{badge.description}</p></div>
  <div className="badge-progress">
   {earned ? <span>Earned <time dateTime={badge.unlocked_at}>{new Date(badge.unlocked_at).toLocaleDateString()}</time></span> :
    <><span>{progress} / {badge.threshold} {achievementMetrics[badge.metric]?.toLowerCase()}</span>
    {!preview && <progress aria-label={badge.name} value={progress} max={badge.threshold} />}</>}
  </div>
 </li>
}
