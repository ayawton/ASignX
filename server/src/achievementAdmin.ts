import { Router } from 'express';
import { connection as sql } from './db/index.js';
import { validUuid } from './gamification.js';

const metrics = ['completed_lessons', 'successful_practices', 'total_xp', 'streak_days'];
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
    const { name, description, metric, threshold, icon } = value;
    const [badge] = await sql`insert into achievements(code,name,description,metric,threshold,icon,status)
        values(gen_random_uuid()::text,${name},${description},${metric},${threshold},${icon},'draft') returning id`;
    res.status(201).json(badge);
});

achievementAdmin.patch('/achievements/:id', async (req, res) => {
    const id = req.params.id;
    const value = achievementValues(req.body);
    const status = req.body?.status;
    if (!validUuid(id) || !value || !statuses.includes(status)) {
        res.status(400).json({ error: 'Enter valid achievement details and status.' }); return;
    }
    const { name, description, metric, threshold, icon } = value;
    try {
        const [badge] = await sql`update achievements set name=${name},description=${description},
            metric=${metric},threshold=${threshold},icon=${icon},status=${status} where id=${id} returning id`;
        res.status(badge ? 200 : 404).json(badge ?? { error: 'Achievement unavailable.' });
    } catch (error) {
        if ((error as { code?: string }).code !== '23514') throw error;
        res.status(409).json({ error: 'This achievement has already been earned. Its requirement is locked.' });
    }
});

function achievementValues(body: unknown) {
    if (!body || typeof body !== 'object') return null;
    const { name, description, metric, threshold, icon } = body as Record<string, unknown>;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 ||
        typeof description !== 'string' || !description.trim() || description.trim().length > 1000 ||
        typeof metric !== 'string' || !metrics.includes(metric) || typeof icon !== 'string' ||
        !icons.includes(icon) || typeof threshold !== 'number' || !Number.isInteger(threshold) ||
        threshold < 1 || threshold > 2147483647) return null;
    return { name: name.trim(), description: description.trim(), metric, threshold, icon };
}
