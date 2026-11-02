import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { connection as sql } from './db/index.js';
import { authenticate } from './personal.js';

import { lessonValues, writeLessonContent } from './courseAuthoring.js';
import { courseImportRoutes } from './courseImportRoutes.js';
import { recognitionCapabilities } from './recognitionTransport.js';

export const admin = Router();

export async function requireAdmin(_req: Request, res: Response, next: NextFunction) {
 const [profile] = await sql`select role from profiles where id = ${res.locals.user.id}`;
 if (profile?.role !== 'admin') { res.status(403).json({ error: 'Administrator access required.' }); return; }
 next();
}
admin.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); }, authenticate, requireAdmin);
admin.use(courseImportRoutes);
admin.get('/overview', async (_req, res) => {
 const [[counts],recent_courses] = await Promise.all([
  sql`select
  (select count(*)::int from profiles where role='learner') as learners,
  (select count(*)::int from courses) as courses,
  (select count(*)::int from courses where is_published) as published_courses,
  (select count(*)::int from courses c where not is_published and exists(select 1 from lessons l where l.course_id=c.id and l.is_published)) as archived_courses,
  (select count(*)::int from lessons) as lessons,
  (select count(*)::int from enrollments) as enrollments,
  (select count(*)::int from lesson_progress where completed_at is not null) as completed_lessons`,
  sql`select c.id,c.title,c.is_published,c.created_at,(not c.is_published and exists(select 1 from lessons l where l.course_id=c.id and l.is_published)) as is_archived from courses c order by c.created_at desc,c.id limit 5`
 ]);
 res.json({ ...counts, recent_courses });
});
const validId = (id: unknown) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
admin.param('id', (req, res, next, id) => {
 if (!validId(id)) { res.status(400).json({ error: 'Choose a valid course.' }); return; } next();
});
admin.get('/recognition-signs',async(_req,res)=>{try{res.json(await recognitionCapabilities())}catch{res.status(503).json({error:'Start the recognition service to choose supported target signs.'})}});
admin.get('/signs', async (_req,res) => {
 res.json(await sql`select id,gloss,meaning,category,instructions,is_published,demo_path from signs order by gloss`);
});
admin.post('/signs/:id/video',async(req,res)=>{
 const path=req.body?.demo_path;
 const id=req.params.id as string;
 if(typeof path!=='string' || !path.startsWith(`signs/${id}/`) || !/^signs\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.mp4$/.test(path)){res.status(400).json({error:'Choose an MP4 uploaded for this sign.'});return;}
 const [object]=await sql`select metadata from storage.objects where bucket_id='learning-media' and name=${path}`;
 if(!object || object.metadata?.mimetype!=='video/mp4' || !(Number(object.metadata?.size)>0) || Number(object.metadata?.size)>20971520){res.status(400).json({error:'Upload an MP4 no larger than 20 MB before saving.'});return;}
 const [sign]=await sql`update signs set demo_path=${path} where id=${id} returning id,demo_path`;
 if(!sign){res.status(404).json({error:'Sign not found.'});return;}
 res.json(sign);
});
function signValues(body: Record<string,unknown>) {
 const {gloss,meaning,category,instructions,is_published} = body;
 if (typeof gloss!=='string' || !gloss.trim() || gloss.trim().length>100 || typeof meaning!=='string' || !meaning.trim() || meaning.length>2000 || (category!=null && (typeof category!=='string' || category.length>60)) || (instructions!=null && (typeof instructions!=='string' || instructions.length>6000)) || typeof is_published!=='boolean') return null;
 return {gloss:gloss.trim().toUpperCase(),meaning:meaning.trim(),category:typeof category==='string' ? category.trim() || null : null,instructions:typeof instructions==='string' ? instructions.trim() || null : null,is_published};
}
async function saveSign(req: Request,res: Response) {
 const value=signValues(req.body ?? {});
 if (!value) { res.status(400).json({error:'Enter a sign label (1–100 characters), meaning (up to 2,000), category (up to 60), and instructions (up to 6,000).'}); return; }
 try {
  const rows = req.params.id
   ? await sql`update signs set gloss=${value.gloss},meaning=${value.meaning},category=${value.category},instructions=${value.instructions},is_published=${value.is_published} where id=${req.params.id as string} and not is_published returning id,gloss,meaning,category,instructions,is_published`
   : await sql`insert into signs(gloss,meaning,category,instructions,is_published) values(${value.gloss},${value.meaning},${value.category},${value.instructions},${value.is_published}) returning id,gloss,meaning,category,instructions,is_published`;
  if (!rows.length) { res.status(409).json({error:'This sign is published or unavailable. Create a new draft for changes.'}); return; }
  res.status(req.params.id ? 200 : 201).json(rows[0]);
 } catch(error) { if ((error as {code?:string}).code==='23505') {res.status(409).json({error:'That sign label already exists. Choose another label.'}); return;} throw error; }
}
admin.post('/signs',saveSign);
admin.patch('/signs/:id',saveSign);
admin.get('/courses/:id', async (req, res) => {
 const [course] = await sql`select c.id,c.title,c.description,c.cover_text,c.cover_size,c.cover_angle,c.cover_density,c.cover_weight,c.cover_font,c.cover_style,c.cover_tone,c.is_published,(not c.is_published and exists(select 1 from lessons l where l.course_id=c.id and l.is_published)) as is_archived from courses c where c.id=${req.params.id as string}`;
 if (!course) { res.status(404).json({ error: 'Course not found.' }); return; }
 const [lessons,exercises,options,links] = await Promise.all([
  sql`select l.*, (l.is_published or exists(select 1 from lesson_progress p where p.lesson_id=l.id and p.completed_at is not null) or exists(select 1 from exercise_attempts a join exercises x on x.id=a.exercise_id where x.lesson_id=l.id)) as locked from lessons l where course_id=${course.id} order by sort_order`,
  sql`select x.* from exercises x join lessons l on l.id=x.lesson_id where l.course_id=${course.id} order by x.sort_order`,
  sql`select o.* from exercise_options o join exercises x on x.id=o.exercise_id join lessons l on l.id=x.lesson_id where l.course_id=${course.id} order by o.sort_order`,
  sql`select ls.lesson_id,ls.sign_id from lesson_signs ls join lessons l on l.id=ls.lesson_id where l.course_id=${course.id} order by ls.sort_order`
 ]);
 res.json({ ...course, lessons: lessons.map(l => ({ ...l,sign_ids:links.filter(link => link.lesson_id===l.id).map(link => link.sign_id), exercises: exercises.filter(x => x.lesson_id===l.id).map(x => ({ ...x, options: options.filter(o => o.exercise_id===x.id) })) })) });
});
// Course and lesson locks serialize authoring and publication; all quiz writes are atomic.
admin.post('/courses/:id/lessons', async (req, res) => {
 const values = lessonValues(req.body ?? {});
 const signIds = req.body?.sign_ids;
 if (signIds!==undefined && (!Array.isArray(signIds) || signIds.length>50 || !signIds.every(validId) || new Set(signIds).size!==signIds.length)) {res.status(400).json({error:'Choose up to 50 distinct published signs.'}); return;}
 if(values?.exercises.some(q=>q.answer_type==='recognition')){try{const capabilities=await recognitionCapabilities();const ids=values.exercises.filter(q=>q.answer_type==='recognition').map(q=>q.sign_id!);const targets=await sql`select id,gloss from signs where id=any(${ids}::uuid[]) and is_published`;if(ids.some(id=>!targets.some(s=>s.id===id && capabilities.labels.includes(s.gloss) && signIds?.includes(id)))){res.status(400).json({error:'Choose a supported published sign linked to this lesson.'});return;}}catch{res.status(503).json({error:'Start the recognition service before saving sign questions.'});return;}}
 if (!values || (req.body.lesson_id && !validId(req.body.lesson_id))) { res.status(400).json({ error: 'Check the lesson fields. Each question needs 2–6 choices and exactly one correct answer.' }); return; }
 try {
  const saved = await sql.begin(async tx => {
   const [course] = await tx`select id from courses c where id=${req.params.id as string} and not is_published and not exists(select 1 from lessons l where l.course_id=c.id and l.is_published) for update`;
   if (!course) return null;
   if (signIds?.length) {
    const available = await tx`select id from signs where id=any(${signIds}::uuid[]) and is_published for share`;
    if (available.length!==signIds.length) return {error:'Some selected signs are unavailable. Choose published signs from the library.'};
   }
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
   if (signIds!==undefined) {
    await tx`delete from lesson_signs where lesson_id=${lesson.id}`;
   }
   await writeLessonContent(tx,lesson.id,values.exercises,signIds??[]);
   return { id: lesson.id };
  });
  if (!saved) { res.status(409).json({ error: 'This course or lesson is published or already used. Create a new draft lesson.' }); return; }
  if ('error' in saved) {res.status(409).json(saved); return;}
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
  const invalid = await tx`select x.id from exercises x join lessons l on l.id=x.lesson_id left join exercise_options o on o.exercise_id=x.id where l.course_id=${course.id} group by x.id having (x.answer_type<>'recognition' and (count(o.id)<2 or count(o.id) filter(where o.is_correct)<>1)) or (x.answer_type='recognition' and count(o.id)<>0)`;
  if (invalid.length) return 'Every question needs at least two choices and exactly one correct answer.';
  await tx`update lessons set is_published=true where course_id=${course.id}`;
  await tx`update courses set is_published=true where id=${course.id}`;
  return null;
 });
 if (result) { res.status(409).json({ error: result }); return; }
 res.json({ published: true });
});
admin.post('/courses/:id/archive',async(req,res)=>{
 const [course]=await sql`update courses set is_published=false where id=${req.params.id as string} and is_published returning id`;
 if(!course){res.status(409).json({error:'This course is already hidden or unavailable.'});return;}
 res.json({id:course.id,archived:true});
});
admin.post('/courses/:id/copy',async(req,res)=>{
 const result=await sql.begin(async tx=>{
  const [original]=await tx`select * from courses where id=${req.params.id as string} for update`;
  if(!original)return null;
  const [copy]=await tx`insert into courses(title,description,cover_text,cover_size,cover_angle,cover_density,cover_weight,cover_font,cover_style,cover_tone,is_published) values(${`${original.title.slice(0,137)} (draft copy)`},${original.description},${original.cover_text},${original.cover_size},${original.cover_angle},${original.cover_density},${original.cover_weight},${original.cover_font},${original.cover_style},${original.cover_tone},false) returning id`;
  if(!copy)throw new Error('Draft copy failed');
  const lessons=await tx`select * from lessons where course_id=${original.id} order by sort_order for update`;
  for(const lesson of lessons){
   const [created]=await tx`insert into lessons(course_id,title,content,sort_order,xp_reward,is_published) values(${copy.id},${lesson.title},${lesson.content},${lesson.sort_order},${lesson.xp_reward},false) returning id`;
   if(!created)throw new Error('Lesson copy failed');
   await tx`insert into lesson_signs(lesson_id,sign_id,sort_order) select ${created.id},sign_id,sort_order from lesson_signs where lesson_id=${lesson.id}`;
   const questions=await tx`select * from exercises where lesson_id=${lesson.id} order by sort_order`;
   for(const question of questions){
    const [q]=await tx`insert into exercises(lesson_id,prompt,sign_id,sort_order,answer_type) values(${created.id},${question.prompt},${question.sign_id},${question.sort_order},${question.answer_type}) returning id`;
    if(!q)throw new Error('Question copy failed');
    await tx`insert into exercise_options(exercise_id,option_text,is_correct,sort_order) select ${q.id},option_text,is_correct,sort_order from exercise_options where exercise_id=${question.id}`;
   }
  }
  return copy;
 });
 if(!result){res.status(404).json({error:'Course not found.'});return;}
 res.status(201).json(result);
});
admin.get('/courses', async (_req, res) => {
 res.json(await sql`select c.id,c.title,c.description,c.cover_text,c.cover_size,c.cover_angle,c.cover_density,c.cover_weight,c.cover_font,c.cover_style,c.cover_tone,c.is_published,(not c.is_published and exists(select 1 from lessons l where l.course_id=c.id and l.is_published)) as is_archived from courses c order by c.created_at desc,c.id`);
});
function courseValues(body: Record<string, unknown>) {
 const title = typeof body.title === 'string' ? body.title.trim() : '';
 const description = typeof body.description === 'string' ? body.description.trim() : '';
 if (!title || title.length > 150 || description.length > 5000 || (body.description != null && typeof body.description !== 'string')) return null;
 const cover_size = body.cover_size ?? 100;
 const cover_angle = body.cover_angle ?? -18;
 const cover_density = body.cover_density ?? 5;
 const cover_weight = body.cover_weight ?? '600';
 const cover_font = body.cover_font ?? 'outfit';
 const cover_text = body.cover_text ?? ''; const cover_style = body.cover_style ?? 'plain'; const cover_tone = body.cover_tone ?? 'sky';
 if (!Number.isInteger(cover_size) || Number(cover_size)<60 || Number(cover_size)>180 || !Number.isInteger(cover_angle) || Number(cover_angle)<-45 || Number(cover_angle)>45 || !Number.isInteger(cover_density) || Number(cover_density)<1 || Number(cover_density)>5 || !['400','600','700'].includes(cover_weight as string) || !['outfit','sans','serif','mono','chalk'].includes(cover_font as string) || typeof cover_text !== 'string' || cover_text.trim().length>32 || !['plain','pattern','corner','frame','split'].includes(cover_style as string) || !['sky','yellow','pink','ink','mint','lavender','peach','aqua','sand'].includes(cover_tone as string)) return null;
 return { title, description: description || null, cover_size: Number(cover_size), cover_angle: Number(cover_angle), cover_density: Number(cover_density), cover_weight: cover_weight as string, cover_font: cover_font as string, cover_text: cover_text.trim(), cover_style: cover_style as string, cover_tone: cover_tone as string };
}
admin.post('/courses', async (req, res) => {
 const values = courseValues(req.body ?? {});
 if (!values) { res.status(400).json({ error: 'Enter a title of 1–150 characters and a description of at most 5,000 characters.' }); return; }
 const [course] = await sql`insert into courses (title, description, cover_text, cover_size, cover_angle, cover_density, cover_weight, cover_font, cover_style, cover_tone, is_published) values (${values.title}, ${values.description}, ${values.cover_text}, ${values.cover_size}, ${values.cover_angle}, ${values.cover_density}, ${values.cover_weight}, ${values.cover_font}, ${values.cover_style}, ${values.cover_tone}, false) returning id, title, description, is_published`;
 res.status(201).json(course);
});
admin.patch('/courses/:id', async (req, res) => {
 const id = req.params.id as string;
 if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) { res.status(400).json({ error: 'Choose a valid course.' }); return; }
 const values = courseValues(req.body ?? {});
 if (!values) { res.status(400).json({ error: 'Enter a title of 1–150 characters and a description of at most 5,000 characters.' }); return; }
 const [course] = await sql`update courses set title = ${values.title}, description = ${values.description}, cover_text=${values.cover_text}, cover_font=${values.cover_font}, cover_weight=${values.cover_weight}, cover_density=${values.cover_density}, cover_angle=${values.cover_angle}, cover_size=${values.cover_size}, cover_style=${values.cover_style}, cover_tone=${values.cover_tone} where id = ${id} returning id, title, description, is_published`;
 if (!course) { res.status(404).json({ error: 'Course not found. Reload the course list.' }); return; }
 res.json(course);
});
