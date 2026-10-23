import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { connection as sql } from './db/index.js';

export const personal = Router();
export async function authenticate(req: Request, res: Response, next: NextFunction) {
    const token = req.headers.authorization?.match(/^Bearer ([^\s]+)$/)?.[1];
    if (!token) { res.status(401).json({ error: 'Please log in.' }); return; }
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) { res.status(503).json({ error: 'Account service is not configured.' }); return; }
    try {
        const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
        if (!response.ok) { res.status(response.status >= 500 ? 503 : 401).json({ error: 'Unable to verify your session. Please log in again.' }); return; }
        const user = await response.json() as { id?: string; email?: string; email_confirmed_at?: string };
        if (!user.id || !user.email_confirmed_at) { res.status(401).json({ error: 'Confirm your email before continuing.' }); return; }
        res.locals.user = user;
        next();
    } catch { res.status(503).json({ error: 'Account service is temporarily unavailable.' }); }
}
personal.use(authenticate);
personal.get('/profile', async (_req, res) => {
    const [profile] = await sql`select id, display_name, role, timezone from profiles where id = ${res.locals.user.id}`;
    if (!profile) { res.status(503).json({ error: 'Your account profile is not ready. Contact the project administrator.' }); return; }
    res.json({ ...profile, email: res.locals.user.email });
});
personal.patch('/profile', async (req, res) => {
    const { display_name, timezone } = req.body;
    if (typeof display_name !== 'string' || !display_name.trim() || display_name.trim().length > 100 || typeof timezone !== 'string' || timezone.length > 64) { res.status(400).json({ error: 'Enter a name and valid time zone.' }); return; }
    try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { res.status(400).json({ error: 'Choose a valid IANA time zone.' }); return; }
    const [profile] = await sql`update profiles set display_name = ${display_name.trim()}, timezone = ${timezone}, updated_at = now() where id = ${res.locals.user.id} returning id, display_name, role, timezone`;
    if (!profile) { res.status(404).json({ error: 'Profile not found.' }); return; }
    res.json({ ...profile, email: res.locals.user.email });
});
personal.get('/progress', async (_req, res) => {
    const lessons = await sql`select lp.lesson_id, l.title, lp.completed_at, lp.xp_earned from lesson_progress lp join enrollments e on e.id = lp.enrollment_id join lessons l on l.id = lp.lesson_id where e.user_id = ${res.locals.user.id}`;
    const achievements = await sql`select a.id, a.name, a.description, ua.unlocked_at from user_achievements ua join achievements a on a.id = ua.achievement_id where ua.user_id = ${res.locals.user.id}`;
    const [streak] = await sql`select asignx_private.current_streak(${res.locals.user.id}::uuid) as days`;
    res.json({ lessons, achievements, streak: streak?.days ?? 0, xp: lessons.reduce((sum, row) => sum + row.xp_earned, 0) });
});
personal.post('/enrollments', async (req, res) => {
    if (typeof req.body.course_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(req.body.course_id)) { res.status(400).json({ error: 'Choose a published course.' }); return; }
    const rows = await sql`insert into enrollments (user_id, course_id) select ${res.locals.user.id}, id from courses where id = ${req.body.course_id} and is_published on conflict (user_id, course_id) do update set user_id = excluded.user_id returning id, course_id, enrolled_at`;
    if (!rows.length) { res.status(404).json({ error: 'Published course not found.' }); return; }
    res.json(rows[0]);
});


