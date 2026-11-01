import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';

test('course details enforce enrollment/publication and return only ordered personal lesson status', async () => {
 const db = new PGlite();
 const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
 // Run the real route and SQL against a disposable database; never use .env or hosted data.
 globalThis.__courseTestSql = async (parts, ...values) => {
  const query = parts.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '');
  return (await db.query(query, values)).rows;
 };
 try {
  await db.exec(`create table courses(id uuid, title text, description text, is_published boolean);
   create table enrollments(id uuid, user_id uuid, course_id uuid);
   create table lessons(id uuid, course_id uuid, title text, sort_order integer, xp_reward integer, is_published boolean);
   create table lesson_progress(enrollment_id uuid, lesson_id uuid, started_at timestamptz, completed_at timestamptz);
   insert into courses values ('${id(10)}','Alphabet','Introduction',true),('${id(11)}','Draft',null,false),('${id(12)}','Empty',null,true);
   insert into enrollments values ('${id(20)}','${id(1)}','${id(10)}'),('${id(21)}','${id(2)}','${id(10)}'),('${id(22)}','${id(1)}','${id(11)}'),('${id(23)}','${id(1)}','${id(12)}');
   insert into lessons values ('${id(30)}','${id(10)}','Second',2,20,true),('${id(31)}','${id(10)}','First',1,10,true),('${id(32)}','${id(10)}','Hidden',3,10,false);
   insert into lesson_progress values ('${id(21)}','${id(30)}',now(),now()),('${id(20)}','${id(31)}',now(),null);`);
  await db.exec(`alter table lessons add column content text;
   update lessons set content='<script>plain text only</script>' where id='${id(31)}';
   insert into lessons values ('${id(33)}','${id(11)}','Draft course lesson',1,10,true,null);
   create table signs(id uuid, gloss text, meaning text, instructions text, is_published boolean);
   create table lesson_signs(lesson_id uuid, sign_id uuid, sort_order integer);
   create table exercises(id uuid, lesson_id uuid, prompt text, sort_order integer);
   create table exercise_options(id uuid, exercise_id uuid, option_text text, sort_order integer, is_correct boolean);
   create table exercise_attempts(id uuid,exercise_id uuid,enrollment_id uuid,selected_option_id uuid,is_correct boolean,attempted_at timestamptz);
   insert into signs values ('${id(40)}','A','Letter A','Instructions',true),('${id(41)}','Hidden','Private','Private',false);
   insert into lesson_signs values ('${id(31)}','${id(40)}',2),('${id(31)}','${id(41)}',1);
   insert into exercises values ('${id(50)}','${id(31)}','Second question',2),('${id(51)}','${id(31)}','First question',1);
   insert into exercise_options values ('${id(60)}','${id(51)}','Later choice',2,true),('${id(61)}','${id(51)}','First choice',1,false);`);
  await db.exec('alter table signs add column demo_path text');
  const bundle = await build({ entryPoints: ['src/personal.ts'], bundle: true, write: false, platform: 'node', format: 'esm', packages: 'external', plugins: [{ name: 'isolated-db', setup(builder) {
   builder.onResolve({ filter: /^\.\/db\/index\.js$/ }, () => ({ path: 'db', namespace: 'test' }));
   builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const connection = (...args) => globalThis.__courseTestSql(...args)' }));
  } }] });
  // Resolve Express from this project while importing the bundled TypeScript module.
  const source = bundle.outputFiles[0].text.replace('from "express"', `from ${JSON.stringify(import.meta.resolve('express'))}`);
  const { personal } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const handler = personal.stack.find(layer => layer.route?.path === '/courses/:id').route.stack[0].handle;
  async function request(course, user = id(1), routeHandler = handler) {
   const res = { locals: { user: { id: user } }, code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
   await routeHandler({ params: { id: course } }, res);
   return res;
  }
  assert.equal((await request('invalid')).code, 400);
  for (const [course, user] of [[id(10), id(3)], [id(11), id(1)], [id(99), id(1)]]) assert.equal((await request(course, user)).code, 404);
  const result = await request(id(10));
  assert.equal(result.code, 200);
  assert.deepEqual(result.body.lessons.map(lesson => lesson.title), ['First', 'Second']);
  assert.ok(result.body.lessons[0].started_at);
  assert.equal(result.body.lessons[1].completed_at, null, 'Another learner completion is never returned');
  assert.deepEqual((await request(id(12))).body.lessons, []);
  const lessonHandler = personal.stack.find(layer => layer.route?.path === '/lessons/:id').route.stack[0].handle;
  const lessonRequest = (lesson, user = id(1)) => request(lesson, user, lessonHandler);
  assert.equal((await lessonRequest('invalid')).code, 400);
  for (const [lesson, user] of [[id(31), id(3)], [id(32), id(1)], [id(33), id(1)], [id(99), id(1)]]) assert.equal((await lessonRequest(lesson, user)).code, 404);
  const loaded = (await lessonRequest(id(31))).body;
  assert.equal(loaded.content, '<script>plain text only</script>');
  assert.deepEqual(loaded.signs.map(sign => sign.gloss), ['A']);
  assert.deepEqual(loaded.exercises.map(exercise => exercise.prompt), ['First question', 'Second question']);
  assert.deepEqual(loaded.exercises[0].options.map(option => option.option_text), ['First choice', 'Later choice']);
  assert.ok(loaded.exercises[0].options.every(option => !('is_correct' in option)), 'No answer keys in response');
  await db.exec(`insert into exercise_attempts values
   ('${id(70)}','${id(51)}','${id(20)}','${id(60)}',true,now()-interval '1 minute'),
   ('${id(71)}','${id(51)}','${id(20)}','${id(61)}',false,now()),
   ('${id(72)}','${id(50)}','${id(21)}','${id(60)}',true,now());`);
  const restored = (await lessonRequest(id(31))).body.exercises;
  assert.equal(restored[0].selected_option_id,id(60),'Saved correct choice restores even after a later wrong attempt');
  assert.equal(restored[0].solved,true);
  assert.equal(restored[1].selected_option_id,null,'Other learner selections stay private');
  await db.exec(`delete from exercise_attempts where id='${id(70)}'`);
  const incorrect = (await lessonRequest(id(31))).body.exercises[0];
  assert.equal(incorrect.selected_option_id,id(61)); assert.equal(incorrect.solved,false);
  assert.deepEqual((await lessonRequest(id(30))).body.exercises, []);
  assert.equal((await db.query('select count(*)::int as count from lesson_progress')).rows[0].count, 2, 'Reading does not create progress');
 } finally { delete globalThis.__courseTestSql; await db.close(); }
});
