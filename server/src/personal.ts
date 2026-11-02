import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { gamification, lessonAction, validUuid, activeRun } from './gamification.js';
import { lessonRecognition } from './lessonRecognition.js';
import { connection as sql } from './db/index.js';

export const personal = Router();
export async function authenticate(req: Request, res: Response, next: NextFunction) {
    const token = req.headers.authorization?.match(/^Bearer ([^\s]+)$/)?.[1];
    if (!token) { res.status(401).json({ error: 'Please log in.' }); return; }
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) { res.status(503).json({ error: 'Account service is not configured.' }); return; }
    const authStarted = performance.now();
    try {
        const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
        if (!response.ok) { res.status(response.status >= 500 ? 503 : 401).json({ error: 'Unable to verify your session. Please log in again.' }); return; }
        const user = await response.json() as { id?: string; email?: string; email_confirmed_at?: string };
        if (!user.id || !user.email_confirmed_at) { res.status(401).json({ error: 'Confirm your email before continuing.' }); return; }
        res.locals.authDuration = (performance.now()-authStarted).toFixed(1);
        res.locals.user = user;
        next();
    } catch { res.status(503).json({ error: 'Account service is temporarily unavailable.' }); }
}
personal.use(authenticate);
personal.use(lessonRecognition);
personal.use(gamification);
const uuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
personal.post('/lessons/:id/:action',async(req,res)=>{
 if(!validUuid(req.params.id)){res.status(400).json({error:'Choose a lesson.'});return;}
 const result=await lessonAction(res.locals.user.id,req.params.id,String(req.params.action),req.body??{});
 res.status(result.status).json(result.body);
});
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
    const [signs, exercises, options, [progress], savedAnswers] = await Promise.all([
        sql`select s.id, s.gloss, s.meaning, s.instructions, s.demo_path
        from lesson_signs ls join signs s on s.id = ls.sign_id
        where ls.lesson_id = ${lessonId} and s.is_published order by ls.sort_order`,
        sql`select x.id, x.prompt, x.sort_order, x.answer_type, s.gloss as target_sign from exercises x left join signs s on s.id=x.sign_id where x.lesson_id = ${lessonId} order by x.sort_order`,
        sql`select o.id, o.exercise_id, o.option_text, o.sort_order
        from exercise_options o join exercises e on e.id = o.exercise_id
        where e.lesson_id = ${lessonId} order by o.sort_order`,
        sql`select lp.* from lesson_progress lp join enrollments e on e.id=lp.enrollment_id where lp.lesson_id=${lessonId} and e.user_id=${res.locals.user.id}`,
        sql`select distinct on (a.exercise_id) a.exercise_id,a.selected_option_id,a.response_text,a.recognition_confidence,a.model_version_id,a.is_correct
        from exercise_attempts a join enrollments e on e.id=a.enrollment_id join exercises x on x.id=a.exercise_id
        where x.lesson_id=${lessonId} and e.user_id=${res.locals.user.id}
        order by a.exercise_id,a.is_correct desc,a.attempted_at desc,a.id desc`
    ]);
    const run=await sql.begin(tx=>activeRun(tx,lessonId,res.locals.user.id));
    res.json({ ...lesson, run, signs, progress: progress ?? null, exercises: exercises.map(exercise => {
        const saved = savedAnswers.find(row => row.exercise_id===exercise.id);
        return { ...exercise, solved: saved?.is_correct ?? false, response_text: saved?.response_text ?? null, recognition_confidence: saved?.recognition_confidence ?? null, selected_option_id: exercise.answer_type==='recognition' ? null : saved?.selected_option_id ?? null, options: exercise.answer_type==='recognition' ? [] : options.filter(option => option.exercise_id === exercise.id) };
    }) });
});
personal.get('/courses/:id', async (req, res) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id as string)) {
        res.status(400).json({ error: 'Choose a valid course.' }); return;
    }
    const [course] = await sql`select c.id, c.title, c.description, c.cover_text, c.cover_style, c.cover_tone, c.cover_font, c.cover_weight, c.cover_size, c.cover_density, c.cover_angle, e.id as enrollment_id
        from courses c join enrollments e on e.course_id = c.id
        where c.id = ${req.params.id as string} and c.is_published and e.user_id = ${res.locals.user.id}`;
    if (!course) { res.status(404).json({ error: 'Course unavailable. Open a published course you are enrolled in.' }); return; }
    const lessons = await sql`select l.id, l.title, l.sort_order, l.xp_reward, lp.started_at, lp.completed_at,
        (select count(*)::int from exercises x where x.lesson_id=l.id) as question_count,
        (select count(*)::int from exercises x where x.lesson_id=l.id and exists(select 1 from exercise_attempts a where a.exercise_id=x.id and a.enrollment_id=${course.enrollment_id} and a.is_correct)) as solved_count
        from lessons l join courses c on c.id = l.course_id
        left join lesson_progress lp on lp.lesson_id = l.id and lp.enrollment_id = ${course.enrollment_id}
        where l.course_id = ${course.id} and l.is_published and c.is_published order by l.sort_order`;
    const { enrollment_id: _enrollmentId, ...details } = course;
    res.json({ ...details, lessons });
});

async function readProfile(user: { id: string; email?: string }) {
 const [profile] = await sql`select id, display_name, role, timezone from profiles where id = ${user.id}`;
 if (!profile) throw new Error('Your account profile is not ready.');
 return { ...profile, email: user.email };
}
async function readProgress(userId: string) {
    const [lessons, achievements, [streak]] = await Promise.all([
        sql`select lp.lesson_id, l.title, lp.completed_at, lp.perfected_at, (select coalesce(sum(a.amount),0) from xp_awards a where a.enrollment_id=lp.enrollment_id and a.lesson_id=lp.lesson_id)::int as xp_earned from lesson_progress lp join enrollments e on e.id = lp.enrollment_id join lessons l on l.id = lp.lesson_id where e.user_id = ${userId}`,
        sql`select a.id, a.name, a.description, ua.unlocked_at from user_achievements ua join achievements a on a.id = ua.achievement_id where ua.user_id = ${userId}`,
        sql`select asignx_private.current_streak(${userId}::uuid) as days`
    ]);
 return { lessons, achievements, streak: streak?.days ?? 0, xp: lessons.reduce((sum, row) => sum + row.xp_earned, 0) };
}
async function readEnrollments(userId: string) {
 const rows = await sql`select e.id, e.course_id, e.enrolled_at, c.title, c.description, c.cover_text, c.cover_style, c.cover_tone, c.cover_font, c.cover_weight, c.cover_density, c.cover_angle, c.cover_size, c.is_published,
 (select count(*)::int from lessons l where l.course_id=c.id and l.is_published) as total_lessons,
 (select count(*)::int from lesson_progress lp join lessons l on l.id=lp.lesson_id where lp.enrollment_id=e.id and lp.started_at is not null and l.course_id=c.id and l.is_published) as started_lessons,
 (select count(*)::int from lesson_progress lp join lessons l on l.id=lp.lesson_id where lp.enrollment_id=e.id and lp.completed_at is not null and l.course_id=c.id and l.is_published) as completed_lessons
 from enrollments e join courses c on c.id = e.course_id where e.user_id = ${userId} order by e.enrolled_at desc`;
 return rows;
}
async function readCourses() { return sql`select id,title,description,cover_text,cover_size,cover_angle,cover_density,cover_weight,cover_font,cover_style,cover_tone from courses where is_published order by title`; }


personal.get('/dashboard', async (_req,res) => {
 const user = res.locals.user;
 const names = ['profile','progress','enrollments','courses'] as const;
 const started = performance.now();
 const results = await Promise.allSettled([readProfile(user),readProgress(user.id),readEnrollments(user.id),readCourses()]);
 const resources: Record<string,unknown> = {}, errors: Record<string,string> = {};
 results.forEach((result,index)=>{ if(result.status==='fulfilled') resources[names[index]!]=result.value; else errors[names[index]!]='Unable to load this section. Try again.'; });
 res.setHeader?.('Server-Timing', `auth;dur=${res.locals.authDuration ?? 0}, data;dur=${(performance.now()-started).toFixed(1)}`);
 res.json({resources,errors});
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
personal.get('/progress', async (_req, res) => { res.json(await readProgress(res.locals.user.id)); });
personal.get('/enrollments', async (_req, res) => {
    const rows = await sql`select e.id, e.course_id, e.enrolled_at, c.title, c.description, c.cover_text, c.cover_style, c.cover_tone, c.cover_font, c.cover_weight, c.cover_density, c.cover_angle, c.cover_size, c.is_published,
 (select count(*)::int from lessons l where l.course_id=c.id and l.is_published) as total_lessons,
 (select count(*)::int from lesson_progress lp join lessons l on l.id=lp.lesson_id where lp.enrollment_id=e.id and lp.started_at is not null and l.course_id=c.id and l.is_published) as started_lessons,
 (select count(*)::int from lesson_progress lp join lessons l on l.id=lp.lesson_id where lp.enrollment_id=e.id and lp.completed_at is not null and l.course_id=c.id and l.is_published) as completed_lessons
 from enrollments e join courses c on c.id = e.course_id where e.user_id = ${res.locals.user.id} order by e.enrolled_at desc`;
    res.json(rows);
});
personal.post('/enrollments', async (req, res) => {
    if (typeof req.body.course_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(req.body.course_id)) { res.status(400).json({ error: 'Choose a published course.' }); return; }
    const rows = await sql`insert into enrollments (user_id, course_id) select ${res.locals.user.id}, id from courses where id = ${req.body.course_id} and is_published on conflict (user_id, course_id) do update set user_id = excluded.user_id returning id, course_id, enrolled_at`;
    if (!rows.length) { res.status(404).json({ error: 'Published course not found.' }); return; }
    res.json(rows[0]);
});


