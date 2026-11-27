import { useId } from 'react'
import { BookOpen, ClipboardCheck, Flame, Zap, Target, GraduationCap } from 'lucide-react'
import { badgeCategories, normalizeBadgeDesign } from '../data/badge-design'

const icons = { completed_lessons: BookOpen, successful_practices: ClipboardCheck, total_xp: Zap, streak_days: Flame, perfect_lessons: Target, completed_courses: GraduationCap }
const seal = Array.from({ length: 32 }, (_, i) => {
 const angle = i * Math.PI / 16 - Math.PI / 2, radius = i % 2 ? 46 : 52
 return `${i ? 'L' : 'M'}${64 + Math.cos(angle) * radius},${62 + Math.sin(angle) * radius}`
}).join(' ') + 'Z'
const shapes = {
 starter: 'M64 11a51 51 0 1 1 0 102 51 51 0 1 1 0-102Z',
 growing: 'M64 10 113 29v35c0 23-22 42-49 53C37 106 15 87 15 64V29Z',
 advanced: 'M64 8 112 35v54l-48 28-48-28V35Z',
 mastery: seal,
}
const star = 'M0-5 1.5-1.5 5 0 1.5 1.5 0 5-1.5 1.5-5 0-1.5-1.5Z'

export default function BadgeSvg({ badge }) {
 const clip = 'badge-' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
 const design = normalizeBadgeDesign(badge.badge_design)
 const palette = badgeCategories[badge.metric] || badgeCategories.completed_lessons
 const Icon = icons[badge.metric] || BookOpen
 const frame = shapes[badge.tier] || shapes.starter
 const edge = design.finish === 'deep' ? '#18294c' : palette.ink
 const ground = design.finish === 'deep' ? palette.tone : palette.light
 return <svg className="badge-svg" viewBox="0 0 128 144" fill="none" aria-hidden="true" focusable="false" strokeLinejoin="round" strokeLinecap="round">
  <defs><clipPath id={clip}><path d={frame} /></clipPath></defs>
  {design.decoration === 'ribbon' && <path d="m34 94-9 43 23-10 14 12 8-39m24-6 9 43-23-10-14 12-8-39" fill={palette.tone} stroke={edge} strokeWidth="2" />}
  {design.decoration === 'wings' && <g fill={palette.tone} stroke={edge} strokeWidth="2"><path d="M25 55 4 35l2 36 21 16M103 55l21-20-2 36-21 16" /><path d="m7 51 16 16m98-16-16 16" /></g>}
  <path d={frame} fill={ground} stroke={edge} strokeWidth="2.5" />
  <g clipPath={`url(#${clip})`} stroke={palette.ink} opacity="0.18" strokeWidth="2">
   {design.pattern === 'rays' && Array.from({ length: 16 }, (_, i) => <path key={i} d="M64 62V5" transform={`rotate(${i * 22.5} 64 62)`} />)}
   {design.pattern === 'stars' && [0, 1, 2, 3].flatMap(row => [0, 1, 2, 3].map(col => <path key={`${row}-${col}`} d={star} transform={`translate(${20 + col * 29} ${20 + row * 28})`} fill={palette.ink} stroke="none" />))}
   {design.pattern === 'diamonds' && [0, 1, 2, 3].flatMap(row => [0, 1, 2, 3].map(col => <path key={`${row}-${col}`} d="m0-9 9 9-9 9-9-9Z" transform={`translate(${20 + col * 29} ${20 + row * 28})`} />))}
  </g>
  {(design.border === 'double' || design.border === 'dotted') && <path d={frame} transform="translate(64 62) scale(.86) translate(-64 -62)" stroke={edge} strokeWidth="1.5" strokeDasharray={design.border === 'dotted' ? '1 5' : undefined} />}
  <circle cx="64" cy="62" r="30" fill={design.finish === 'deep' ? palette.light : '#fff'} />
  {design.border === 'laurel' && <g stroke={edge} strokeWidth="1.5" fill={palette.tone}>
   <path d="M40 93C17 77 18 48 36 31M88 93c23-16 22-45 4-62" />
   {[0, 1, 2, 3, 4].map(i => <g key={i} transform={`rotate(${i * 16 - 32} 64 62)`}><ellipse cx="22" cy="62" rx="5" ry="2.5" transform="rotate(35 22 62)" /><ellipse cx="106" cy="62" rx="5" ry="2.5" transform="rotate(-35 106 62)" /></g>)}
  </g>}
  <Icon x="45" y="43" width="38" height="38" stroke={palette.ink} strokeWidth="1.8" />
  {design.decoration === 'stars' && <g fill={edge}>{[44, 64, 84].map((x, i) => <path key={x} d={star} transform={`translate(${x} ${i === 1 ? 98 : 94}) scale(.8)`} />)}</g>}
 </svg>
}
