import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { connection as sql } from './db/index.js';
import { authenticate } from './personal.js';

export const admin = Router();
export async function requireAdmin(_req: Request, res: Response, next: NextFunction) {
 const [profile] = await sql`select role from profiles where id = ${res.locals.user.id}`;
 if (profile?.role !== 'admin') { res.status(403).json({ error: 'Administrator access required.' }); return; }
 next();
}
admin.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); }, authenticate, requireAdmin);
admin.get('/overview', async (_req, res) => {
 const [counts] = await sql`select
  (select count(*)::int from profiles where role='learner') as learners,
  (select count(*)::int from courses) as courses,
  (select count(*)::int from courses where is_published) as published_courses,
  (select count(*)::int from lessons) as lessons,
  (select count(*)::int from enrollments) as enrollments,
  (select count(*)::int from lesson_progress where completed_at is not null) as completed_lessons`;
 const recent_courses = await sql`select id,title,is_published,created_at from courses order by created_at desc,id limit 5`;
 res.json({ ...counts, recent_courses });
});
const validId = (id: unknown) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
admin.param('id', (req, res, next, id) => {
 if (!validId(id)) { res.status(400).json({ error: 'Choose a valid course.' }); return; } next();
});
admin.get('/courses/:id', async (req, res) => {
 const [course] = await sql`select id,title,description,is_published from courses where id=${req.params.id as string}`;
 if (!course) { res.status(404).json({ error: 'Course not found.' }); return; }
 const lessons = await sql`select l.*, (l.is_published or exists(select 1 from lesson_progress p where p.lesson_id=l.id and p.completed_at is not null) or exists(select 1 from exercise_attempts a join exercises x on x.id=a.exercise_id where x.lesson_id=l.id)) as locked from lessons l where course_id=${course.id} order by sort_order`;
 const exercises = await sql`select x.* from exercises x join lessons l on l.id=x.lesson_id where l.course_id=${course.id} order by x.sort_order`;
 const options = await sql`select o.* from exercise_options o join exercises x on x.id=o.exercise_id join lessons l on l.id=x.lesson_id where l.course_id=${course.id} order by o.sort_order`;
 res.json({ ...course, lessons: lessons.map(l => ({ ...l, exercises: exercises.filter(x => x.lesson_id===l.id).map(x => ({ ...x, options: options.filter(o => o.exercise_id===x.id) })) })) });
});
type Question = { prompt: string; options: { option_text: string; is_correct: boolean }[] };
function lessonValues(body: Record<string, unknown>) {
 const { title, content, sort_order, xp_reward, exercises } = body;
 if (typeof title!=='string' || !title.trim() || title.trim().length>150 || typeof content!=='string' || content.length>6000 || !Number.isInteger(sort_order) || Number(sort_order)<1 || Number(sort_order)>2147483647 || !Number.isInteger(xp_reward) || Number(xp_reward)<0 || Number(xp_reward)>2147483647 || !Array.isArray(exercises) || exercises.length>10) return null;
 for (const q of exercises) {
  if (!q || typeof q.prompt!=='string' || !q.prompt.trim() || q.prompt.length>1000 || !Array.isArray(q.options) || q.options.length<2 || q.options.length>6 || q.options.some((o: Question['options'][number]) => !o || typeof o.option_text!=='string' || !o.option_text.trim() || o.option_text.length>500 || typeof o.is_correct!=='boolean') || q.options.filter((o: Question['options'][number]) => o.is_correct).length!==1) return null;
 }
 return { title: title.trim(), content, sort_order: Number(sort_order), xp_reward: Number(xp_reward), exercises: exercises as Question[] };
}
// Course and lesson locks serialize authoring and publication; all quiz writes are atomic.
admin.post('/courses/:id/lessons', async (req, res) => {
 const values = lessonValues(req.body ?? {});
 if (!values || (req.body.lesson_id && !validId(req.body.lesson_id))) { res.status(400).json({ error: 'Check the lesson fields. Each question needs 2–6 choices and exactly one correct answer.' }); return; }
 try {
  const saved = await sql.begin(async tx => {
   const [course] = await tx`select id from courses where id=${req.params.id as string} and not is_published for update`;
   if (!course) return null;
   let lesson;
   if (req.body.lesson_id) {
    [lesson] = await tx`select * from lessons where id=${req.body.lesson_id} and course_id=${course.id} for update`;
    if (!lesson || lesson.is_published) return null;
    const [used] = await tx`select exists(select 1 from lesson_progress where lesson_id=${lesson.id} and completed_at is not null) or exists(select 1 from exercise_attempts a join exercises x on x.id=a.exercise_id where x.lesson_id=${lesson.id}) as used`;
    if (!used || used.used) return null;
    await tx`update lessons set title=${values.title},content=${values.content},sort_order=${values.sort_order},xp_reward=${values.xp_reward} where id=${lesson.id}`;
    await tx`delete from exercise_options where exercise_id in (select id from exercises where lesson_id=${lesson.id})`;
    await tx`delete from exercises where lesson_id=${lesson.id}`;
   } else {
    [lesson] = await tx`insert into lessons(course_id,title,content,sort_order,xp_reward) values(${course.id},${values.title},${values.content},${values.sort_order},${values.xp_reward}) returning id`;
   }
   if (!lesson) throw new Error('Lesson could not be created');
   for (const [i,q] of values.exercises.entries()) {
    const [exercise] = await tx`insert into exercises(lesson_id,prompt,sort_order) values(${lesson.id},${q.prompt.trim()},${i+1}) returning id`;
    if (!exercise) throw new Error('Question could not be created');
    for (const [j,o] of q.options.entries()) await tx`insert into exercise_options(exercise_id,option_text,is_correct,sort_order) values(${exercise.id},${o.option_text.trim()},${o.is_correct},${j+1})`;
   }
   return { id: lesson.id };
  });
  if (!saved) { res.status(409).json({ error: 'This course or lesson is published or already used. Create a new draft lesson.' }); return; }
  res.json(saved);
 } catch (error) {
  if ((error as { code?: string }).code === '23505') { res.status(409).json({ error: 'Another lesson uses this position. Choose a different lesson order.' }); return; } throw error;
 }
});
admin.post('/courses/:id/publish', async (req,res) => {
 const result = await sql.begin(async tx => {
  const [course] = await tx`select id,is_published from courses where id=${req.params.id as string} for update`;
  if (!course) return 'Course not found.';
  if (course.is_published) return null;
  const lessons = await tx`select id,content from lessons where course_id=${course.id} order by sort_order for update`;
  if (!lessons.length || lessons.some(l => !l.content?.trim())) return 'Add at least one lesson and written material for every lesson before publishing.';
  const invalid = await tx`select x.id from exercises x join lessons l on l.id=x.lesson_id left join exercise_options o on o.exercise_id=x.id where l.course_id=${course.id} group by x.id having count(o.id)<2 or count(o.id) filter(where o.is_correct)<>1`;
  if (invalid.length) return 'Every question needs at least two choices and exactly one correct answer.';
  await tx`update lessons set is_published=true where course_id=${course.id}`;
  await tx`update courses set is_published=true where id=${course.id}`;
  return null;
 });
 if (result) { res.status(409).json({ error: result }); return; }
 res.json({ published: true });
});
admin.get('/courses', async (_req, res) => {
 res.json(await sql`select id, title, description, is_published from courses order by created_at desc, id`);
});
function courseValues(body: Record<string, unknown>) {
 const title = typeof body.title === 'string' ? body.title.trim() : '';
 const description = typeof body.description === 'string' ? body.description.trim() : '';
 if (!title || title.length > 150 || description.length > 5000 || (body.description != null && typeof body.description !== 'string')) return null;
 return { title, description: description || null };
}
admin.post('/courses', async (req, res) => {
 const values = courseValues(req.body ?? {});
 if (!values) { res.status(400).json({ error: 'Enter a title of 1–150 characters and a description of at most 5,000 characters.' }); return; }
 const [course] = await sql`insert into courses (title, description, is_published) values (${values.title}, ${values.description}, false) returning id, title, description, is_published`;
 res.status(201).json(course);
});
admin.patch('/courses/:id', async (req, res) => {
 const id = req.params.id as string;
 if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) { res.status(400).json({ error: 'Choose a valid course.' }); return; }
 const values = courseValues(req.body ?? {});
 if (!values) { res.status(400).json({ error: 'Enter a title of 1–150 characters and a description of at most 5,000 characters.' }); return; }
 const [course] = await sql`update courses set title = ${values.title}, description = ${values.description} where id = ${id} and not is_published returning id, title, description, is_published`;
 if (!course) { res.status(409).json({ error: 'This draft is unavailable or has been published. Reload the course list.' }); return; }
 res.json(course);
});
