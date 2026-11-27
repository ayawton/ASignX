export const badgeTiers = { starter: 'Starter', growing: 'Growing', advanced: 'Advanced', mastery: 'Mastery' }
export const badgeShapes = { starter: 'Circle', growing: 'Shield', advanced: 'Hexagon', mastery: 'Ornate seal' }
export const designOptions = {
 border: ['single', 'double', 'dotted', 'laurel'],
 pattern: ['solid', 'rays', 'stars', 'diamonds'],
 decoration: ['none', 'ribbon', 'wings', 'stars'],
 finish: ['classic', 'deep'],
}
export const defaultBadgeDesign = { version: 1, border: 'double', pattern: 'solid', decoration: 'none', finish: 'classic' }
export const badgeCategories = {
 completed_lessons: { label: 'Learning', icon: 'Book', ink: '#2962f5', light: '#edf3ff', tone: '#bfd1ff' },
 successful_practices: { label: 'Practice', icon: 'Checklist', ink: '#14716c', light: '#eaf7f4', tone: '#b6ded5' },
 total_xp: { label: 'Experience', icon: 'Lightning', ink: '#8b6513', light: '#fff8df', tone: '#f2d57a' },
 streak_days: { label: 'Consistency', icon: 'Flame', ink: '#ab4c19', light: '#fff1e8', tone: '#f5c29e' },
 perfect_lessons: { label: 'Precision', icon: 'Target', ink: '#254168', light: '#edf2f8', tone: '#bdcce0' },
 completed_courses: { label: 'Courses', icon: 'Graduation cap', ink: '#307044', light: '#edf6ee', tone: '#badabb' },
}
export function normalizeBadgeDesign(value) {
 return Object.fromEntries(Object.entries(defaultBadgeDesign).map(([key, fallback]) =>
  [key, key === 'version' ? 1 : designOptions[key].includes(value?.[key]) ? value[key] : fallback]))
}
export function designSignature(badge) {
 if (!badge.badge_design) return null
 return JSON.stringify([badge.metric, badge.tier || 'starter', normalizeBadgeDesign(badge.badge_design)])
}
export function unusedBadgeDesign(badge, catalog, random = Math.random) {
 const used = new Set(catalog.filter(b => b.id !== badge.id).map(designSignature).filter(Boolean))
 used.add(designSignature(badge))
 const choices = []
 for (const border of designOptions.border) for (const pattern of designOptions.pattern)
  for (const decoration of designOptions.decoration) for (const finish of designOptions.finish) {
   const candidate = { version: 1, border, pattern, decoration, finish }
   if (!used.has(designSignature({ ...badge, badge_design: candidate }))) choices.push(candidate)
  }
 return choices.length ? choices[Math.floor(random() * choices.length)] : null
}
// Only an explicit admin action applies this suggestion. Never infer tiers while rendering.
export function suggestedBadgeTier(badge, catalog) {
 if (!badge.milestone_group?.trim()) return null
 const targets = [...new Set([...catalog.filter(b => b.id !== badge.id && b.metric === badge.metric &&
  b.milestone_group === badge.milestone_group.trim()).map(b => b.threshold), Number(badge.threshold)])].sort((a, b) => a - b)
 return Object.keys(badgeTiers)[Math.min(3, targets.indexOf(Number(badge.threshold)))]
}
