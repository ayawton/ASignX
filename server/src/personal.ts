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
personal.get('/lessons/:id', async (req, res) => {
    const lessonId = req.params.id as string;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lessonId)) {
        res.status(400).json({ error: 'Choose a valid lesson.' }); return;
    }
    const [lesson] = await sql`select l.id, l.course_id, l.title, l.content, l.xp_reward, c.title as course_title
        from lessons l join courses c on c.id = l.course_id
        join enrollments e on e.course_id = c.id
        where l.id = ${lessonId} and l.is_published and c.is_published and e.user_id = ${res.locals.user.id}`;
    if (!lesson) { res.status(404).json({ error: 'Lesson unavailable. Choose a published lesson from your enrolled courses.' }); return; }
    const signs = await sql`select s.id, s.gloss, s.meaning, s.instructions
        from lesson_signs ls join signs s on s.id = ls.sign_id
        where ls.lesson_id = ${lessonId} and s.is_published order by ls.sort_order`;
    const exercises = await sql`select id, prompt, sort_order from exercises where lesson_id = ${lessonId} order by sort_order`;
    const options = await sql`select o.id, o.exercise_id, o.option_text, o.sort_order
        from exercise_options o join exercises e on e.id = o.exercise_id
        where e.lesson_id = ${lessonId} order by o.sort_order`;
    res.json({ ...lesson, signs, exercises: exercises.map(exercise => ({ ...exercise, options: options.filter(option => option.exercise_id === exercise.id) })) });
});
personal.get('/courses/:id', async (req, res) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id as string)) {
        res.status(400).json({ error: 'Choose a valid course.' }); return;
    }
    const [course] = await sql`select c.id, c.title, c.description, e.id as enrollment_id
        from courses c join enrollments e on e.course_id = c.id
        where c.id = ${req.params.id as string} and c.is_published and e.user_id = ${res.locals.user.id}`;
    if (!course) { res.status(404).json({ error: 'Course unavailable. Open a published course you are enrolled in.' }); return; }
    const lessons = await sql`select l.id, l.title, l.sort_order, l.xp_reward, lp.started_at, lp.completed_at
        from lessons l join courses c on c.id = l.course_id
        left join lesson_progress lp on lp.lesson_id = l.id and lp.enrollment_id = ${course.enrollment_id}
        where l.course_id = ${course.id} and l.is_published and c.is_published order by l.sort_order`;
    res.json({ id: course.id, title: course.title, description: course.description, lessons });
});
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
personal.get('/enrollments', async (_req, res) => {
    const rows = await sql`select e.id, e.course_id, e.enrolled_at, c.title, c.description, c.is_published from enrollments e join courses c on c.id = e.course_id where e.user_id = ${res.locals.user.id} order by e.enrolled_at desc`;
    res.json(rows);
});
personal.post('/enrollments', async (req, res) => {
    if (typeof req.body.course_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(req.body.course_id)) { res.status(400).json({ error: 'Choose a published course.' }); return; }
    const rows = await sql`insert into enrollments (user_id, course_id) select ${res.locals.user.id}, id from courses where id = ${req.body.course_id} and is_published on conflict (user_id, course_id) do update set user_id = excluded.user_id returning id, course_id, enrolled_at`;
    if (!rows.length) { res.status(404).json({ error: 'Published course not found.' }); return; }
    res.json(rows[0]);
});


