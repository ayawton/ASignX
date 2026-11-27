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
    if (!value) { res.status(400).json({ error: 'Enter a name, description, and valid badge requirement.' }); return; }
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
        res.status(400).json({ error: 'Enter valid achievement details and status.' }); return;
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
        milestone_group: typeof milestone_group === 'string' ? milestone_group.trim() : null, badge_design };
}
