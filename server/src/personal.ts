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
const uuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
personal.post('/lessons/:id/:action', async (req,res) => {
 const { id,action } = req.params;
 if (!uuid(id) || !['start','attempt','complete'].includes(action as string)) { res.status(400).json({error:'Choose a valid lesson action.'}); return; }
 const body = req.body ?? {};
 if (action==='attempt' && ![body.attempt_id,body.exercise_id,body.selected_option_id].every(uuid)) { res.status(400).json({error:'Choose an answer and valid submission ID.'}); return; }
 const result = await sql.begin(async tx => {
  const [access] = await tx`select l.id,e.id as enrollment_id from lessons l join courses c on c.id=l.course_id join enrollments e on e.course_id=c.id where l.id=${id as string} and l.is_published and c.is_published and e.user_id=${res.locals.user.id} for share of l,c,e`;
  if (!access) return {status:404,body:{error:'Lesson unavailable.'}};
  if (action==='start') {
   await tx`insert into lesson_progress(enrollment_id,lesson_id) values(${access.enrollment_id},${access.id}) on conflict do nothing`;
  }
  const [progress] = await tx`select * from lesson_progress where enrollment_id=${access.enrollment_id} and lesson_id=${access.id} for update`;
  if (!progress) return {status:409,body:{error:'Review the lesson material before continuing.'}};
  if (action==='attempt') {
   const [option] = await tx`select o.id from exercise_options o join exercises x on x.id=o.exercise_id where o.id=${body.selected_option_id} and x.id=${body.exercise_id} and x.lesson_id=${access.id}`;
   if (!option) return {status:400,body:{error:'This choice does not belong to the question.'}};
   await tx`insert into exercise_attempts(id,enrollment_id,exercise_id,selected_option_id,is_correct) values(${body.attempt_id},${access.enrollment_id},${body.exercise_id},${option.id},false) on conflict(id) do nothing`;
   const [saved] = await tx`select is_correct from exercise_attempts where id=${body.attempt_id} and enrollment_id=${access.enrollment_id} and exercise_id=${body.exercise_id} and selected_option_id=${option.id}`;
   if (!saved) return {status:409,body:{error:'Submission ID already used. Choose an answer again.'}};
   return {status:200,body:{correct:saved.is_correct}};
  }
  if (action==='complete' && !progress.completed_at) {
   const missing = await tx`select x.id from exercises x where x.lesson_id=${access.id} and not exists(select 1 from exercise_attempts a where a.enrollment_id=${access.enrollment_id} and a.exercise_id=x.id and a.is_correct)`;
   if (missing.length) return {status:409,body:{error:'Answer every question correctly before completing the lesson.'}};
   const [saved] = await tx`update lesson_progress set completed_at=now() where enrollment_id=${access.enrollment_id} and lesson_id=${access.id} returning *`;
   return {status:200,body:saved};
  }
  return {status:200,body:progress};
 });
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
    const signs = await sql`select s.id, s.gloss, s.meaning, s.instructions, s.demo_path
        from lesson_signs ls join signs s on s.id = ls.sign_id
        where ls.lesson_id = ${lessonId} and s.is_published order by ls.sort_order`;
    const exercises = await sql`select id, prompt, sort_order from exercises where lesson_id = ${lessonId} order by sort_order`;
    const options = await sql`select o.id, o.exercise_id, o.option_text, o.sort_order
        from exercise_options o join exercises e on e.id = o.exercise_id
        where e.lesson_id = ${lessonId} order by o.sort_order`;
    const [progress] = await sql`select lp.* from lesson_progress lp join enrollments e on e.id=lp.enrollment_id where lp.lesson_id=${lessonId} and e.user_id=${res.locals.user.id}`;
    const savedAnswers = await sql`select distinct on (a.exercise_id) a.exercise_id,a.selected_option_id,a.is_correct
        from exercise_attempts a join enrollments e on e.id=a.enrollment_id join exercises x on x.id=a.exercise_id
        where x.lesson_id=${lessonId} and e.user_id=${res.locals.user.id}
        order by a.exercise_id,a.is_correct desc,a.attempted_at desc,a.id desc`;
    res.json({ ...lesson, signs, progress: progress ?? null, exercises: exercises.map(exercise => {
        const saved = savedAnswers.find(row => row.exercise_id===exercise.id);
        return { ...exercise, solved: saved?.is_correct ?? false, selected_option_id: saved?.selected_option_id ?? null, options: options.filter(option => option.exercise_id === exercise.id) };
    }) });
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


