import { Router } from 'express';
import { connection as sql } from './db/index.js';
import { validUuid } from './gamification.js';
import { badgeTiers, metricIcons, validBadgeDesign } from './badgeDesign.js';

const metrics = ['completed_lessons', 'successful_practices', 'total_xp', 'streak_days', 'perfect_lessons', 'completed_courses'];
const icons = ['lesson', 'practice', 'xp', 'streak', 'trophy'];
const statuses = ['draft', 'published', 'retired'];
export const achievementAdmin = Router();

achievementAdmin.get('/achievements', async (_req, res) => {
    res.json(await sql`select a.*, exists(select 1 from profile_achievements p where p.achievement_id=a.id) as requirement_locked
        from achievements a order by a.name, a.id`);
});

achievementAdmin.post('/achievements', async (req, res) => {
    const value = achievementValues(req.body);
    if (!value) { res.status(400).json({ error: 'Check the highlighted fields.', fields: achievementErrors(req.body) }); return; }
    const { name, description, metric, threshold, icon, is_secret, hint, tier, milestone_group, badge_design } = value;
    const [badge] = await sql`insert into achievements(code,name,description,metric,threshold,icon,status,is_secret,hint,tier,milestone_group,badge_design)
        values(gen_random_uuid()::text,${name},${description},${metric},${threshold},${icon},'draft',${is_secret},${hint},${tier},${milestone_group},${badge_design === null ? null : sql.json(badge_design)}) returning id`;
    res.status(201).json(badge);
});

achievementAdmin.patch('/achievements/:id', async (req, res) => {
    const id = req.params.id;
    const value = achievementValues(req.body);
    const status = req.body?.status;
    if (!validUuid(id) || !value || !statuses.includes(status)) {
        res.status(400).json({ error: 'Check the highlighted fields.', fields: achievementErrors(req.body) }); return;
    }
    const { name, description, metric, threshold, icon, is_secret, hint, tier, milestone_group, badge_design } = value;
    try {
        const [badge] = await sql`update achievements set name=${name},description=${description},
            metric=${metric},threshold=${threshold},icon=${icon},is_secret=${is_secret},hint=${hint},status=${status},
            tier=case when ${'tier' in req.body} then ${tier} else tier end,
            milestone_group=case when ${'milestone_group' in req.body} then ${milestone_group} else milestone_group end,
            badge_design=case when ${'badge_design' in req.body} then ${badge_design === null ? null : sql.json(badge_design)}::jsonb else badge_design end
            where id=${id} returning id`;
        res.status(badge ? 200 : 404).json(badge ?? { error: 'Achievement unavailable.' });
    } catch (error) {
        if ((error as { code?: string }).code !== '23514') throw error;
        res.status(409).json({ error: 'This achievement has already been earned. Its requirement is locked.' });
    }
});

function achievementValues(body: unknown) {
    if (!body || typeof body !== 'object') return null;
    const { name, description, metric, threshold, icon: requestedIcon, is_secret = false, hint = '', tier = 'starter', milestone_group = null, badge_design = null } = body as Record<string, unknown>;
    if (typeof tier !== 'string' || !badgeTiers.includes(tier) || !validBadgeDesign(badge_design) ||
        (milestone_group !== null && (typeof milestone_group !== 'string' || !milestone_group.trim() || milestone_group.trim().length > 80))) return null;
    const icon = badge_design && typeof metric === 'string' ? metricIcons[metric] : requestedIcon;
    if (typeof is_secret !== 'boolean' || typeof hint !== 'string' || hint.length > 250 || typeof name !== 'string' || !name.trim() || name.trim().length > 100 ||
        typeof description !== 'string' || !description.trim() || description.trim().length > 1000 ||
        typeof metric !== 'string' || !metrics.includes(metric) || typeof icon !== 'string' ||
        !icons.includes(icon) || typeof threshold !== 'number' || !Number.isInteger(threshold) ||
        threshold < 1 || threshold > 2147483647) return null;
    return { name: name.trim(), description: description.trim(), metric, threshold, icon, is_secret, hint, tier,
        milestone_group: typeof milestone_group === 'string' ? milestone_group.trim() : null, badge_design: badge_design?.finish === 'soft' ? { ...badge_design, finish: 'classic' } : badge_design };
}

function achievementErrors(body: unknown): Record<string, string> {
 const value = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
 const errors: Record<string, string> = {};
 for (const [key, max, label] of [['name',100,'badge name'],['description',1000,'badge description']] as const) {
  if (typeof value[key] !== 'string' || !(value[key] as string).trim()) errors[key] = 'Enter a ' + label + '.';
  else if ((value[key] as string).trim().length > max) errors[key] = 'Use ' + max + ' characters or fewer.';
 }
 if (typeof value.metric !== 'string' || !metrics.includes(value.metric)) errors.metric = 'Choose an achievement requirement.';
 if (typeof value.threshold !== 'number' || !Number.isInteger(value.threshold) || value.threshold < 1 || value.threshold > 2147483647) errors.threshold = 'Enter a whole number from 1 to 2,147,483,647.';
 if (value.milestone_group !== undefined && value.milestone_group !== null && (typeof value.milestone_group !== 'string' || !value.milestone_group.trim() || value.milestone_group.trim().length > 80)) errors.milestone_group = 'Enter a group name with 80 characters or fewer.';
 if (value.hint !== undefined && (typeof value.hint !== 'string' || value.hint.length > 250)) errors.hint = 'Use 250 characters or fewer.';
 if (value.tier !== undefined && (typeof value.tier !== 'string' || !badgeTiers.includes(value.tier))) errors.tier = 'Choose a badge tier.';
 if (value.badge_design !== undefined && !validBadgeDesign(value.badge_design)) errors.badge_design = 'Choose valid design options.';
 return errors;
}
