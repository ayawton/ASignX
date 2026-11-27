import { badgeCategories, badgeTiers } from './badge-design.js'

export function filterBadges(badges, { search = '', status = 'all', type = 'all', visibility = 'all', sort = 'name' } = {}) {
 const term = search.trim().toLowerCase()
 const tiers = Object.keys(badgeTiers)
 return badges.filter(b => (status === 'all' || b.status === status) && (type === 'all' || b.metric === type) &&
  (visibility === 'all' || Boolean(b.is_secret) === (visibility === 'secret')) &&
  [b.name, b.description, badgeCategories[b.metric]?.label, badgeTiers[b.tier || 'starter'], b.milestone_group].join(' ').toLowerCase().includes(term))
  .sort((a, b) => (sort === 'target' ? a.threshold - b.threshold : sort === 'tier' ? tiers.indexOf(a.tier || 'starter') - tiers.indexOf(b.tier || 'starter') : 0) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
}

export function badgeFieldErrors(form) {
 const errors = {}
 if (!form.name?.trim()) errors.name = 'Enter a badge name.'
 else if (form.name.trim().length > 100) errors.name = 'Use 100 characters or fewer.'
 if (!form.description?.trim()) errors.description = 'Enter a badge description.'
 else if (form.description.trim().length > 1000) errors.description = 'Use 1,000 characters or fewer.'
 if (!badgeCategories[form.metric]) errors.metric = 'Choose an achievement requirement.'
 if (!Number.isInteger(form.threshold) || form.threshold < 1 || form.threshold > 2147483647) errors.threshold = 'Enter a whole number from 1 to 2,147,483,647.'
 if (form.milestone_group !== null && !form.milestone_group?.trim()) errors.milestone_group = 'Enter a milestone group name.'
 else if (form.milestone_group?.trim().length > 80) errors.milestone_group = 'Use 80 characters or fewer.'
 if ((form.hint || '').length > 250) errors.hint = 'Use 250 characters or fewer.'
 if (!badgeTiers[form.tier]) errors.tier = 'Choose a badge tier.'
 return errors
}
