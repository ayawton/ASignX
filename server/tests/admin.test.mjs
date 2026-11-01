import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';

test('admin checks current database roles and permits only validated draft writes', async () => {
 const db = new PGlite();
 globalThis.__adminSql = async (parts, ...values) => (await db.query(parts.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, ''), values)).rows;
 globalThis.__adminSql.begin = async callback => { await db.exec('begin'); try { const result = await callback(globalThis.__adminSql); await db.exec('commit'); return result; } catch(error) { await db.exec('rollback'); throw error; } };
 const response = user => ({ locals: { user: { id: user } }, code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; } });
 try {
  await db.exec(`create table profiles(id text, role text); insert into profiles values ('admin','admin'),('learner','learner');
   create table courses(id uuid primary key default gen_random_uuid(),title text,description text,is_published boolean,created_at timestamptz default now());
   create table lessons(id uuid primary key default gen_random_uuid(),course_id uuid,title text,content text,sort_order int,xp_reward int,is_published boolean default false,unique(course_id,sort_order));
   create table exercises(id uuid primary key default gen_random_uuid(),lesson_id uuid,prompt text,sort_order int);
   create table exercise_options(id uuid default gen_random_uuid(),exercise_id uuid,option_text text,is_correct boolean,sort_order int);
   create table lesson_progress(lesson_id uuid,completed_at timestamptz);
   create table exercise_attempts(exercise_id uuid);`);
  await db.exec('create table enrollments(id uuid);');
  const bundle = await build({ entryPoints: ['src/admin.ts'], bundle: true, write: false, platform: 'node', format: 'esm', packages: 'external', plugins: [{ name: 'test-db', setup(builder) {
   builder.onResolve({ filter: /^\.\/db\/index\.js$/ }, () => ({ path: 'db', namespace: 'test' }));
   builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const connection = Object.assign((...args) => globalThis.__adminSql(...args), { begin: fn => globalThis.__adminSql.begin(fn) })' }));
  } }] });
  const source = bundle.outputFiles[0].text.replaceAll('from "express"', `from ${JSON.stringify(import.meta.resolve('express'))}`);
  const { admin, requireAdmin } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  for (const user of ['learner','missing']) {
   const res = response(user); await requireAdmin({}, res, () => assert.fail('non-admin allowed')); assert.equal(res.code, 403);
  }
  let allowed = false; await requireAdmin({}, response('admin'), () => { allowed = true; }); assert.ok(allowed);
  await db.exec("update profiles set role='learner' where id='admin'");
  const revoked = response('admin'); await requireAdmin({}, revoked, () => assert.fail('revoked admin allowed')); assert.equal(revoked.code,403);
  async function call(method, path, body = {}, id = '') {
   const route = admin.stack.find(layer => layer.route?.path === path && layer.route.methods[method]);
   const res = response('admin'); await route.route.stack[0].handle({ body, params: { id } }, res); return res;
  }
  assert.equal((await call('post','/courses',{title:' '})).code,400);
  assert.equal((await call('post','/courses',{title:'x'.repeat(151)})).code,400);
  assert.equal((await call('post','/courses',{title:'Valid',description:'x'.repeat(5001)})).code,400);
  const created = await call('post','/courses',{title:' First course ',description:' Introduction ',is_published:true});
  assert.equal(created.code,201); assert.equal(created.body.is_published,false); assert.equal(created.body.title,'First course');
  const id = created.body.id;
  assert.equal((await call('patch','/courses/:id',{title:'Renamed'},id)).body.title,'Renamed');
  assert.equal((await call('patch','/courses/:id',{title:'Valid'},'bad')).code,400);
  assert.equal((await call('post','/courses/:id/publish',{},id)).code,409,'Empty course cannot publish');
  const lesson = {title:'First lesson', content:'Learn letter A',sort_order:1,xp_reward:10,exercises:[{prompt:'Choose A',options:[{option_text:'A',is_correct:true},{option_text:'B',is_correct:false}]}]};
  assert.equal((await call('post','/courses/:id/lessons',{...lesson,exercises:[{prompt:'Invalid',options:[]}]},id)).code,400);
  const saved = await call('post','/courses/:id/lessons',lesson,id); assert.equal(saved.code,200);
  assert.equal((await call('post','/courses/:id/lessons',lesson,id)).code,409,'Duplicate order rejected');
  assert.equal((await call('post','/courses/:id/lessons',{...lesson,lesson_id:saved.body.id,title:'Revised'},id)).code,200);
  const detail = await call('get','/courses/:id',{},id);
  assert.equal(detail.body.lessons.length,1); assert.equal(detail.body.lessons[0].title,'Revised');
  assert.equal(detail.body.lessons[0].exercises[0].options[0].is_correct,true);
  await db.query('insert into exercise_attempts select id from exercises');
  assert.equal((await call('post','/courses/:id/lessons',{...lesson,lesson_id:saved.body.id},id)).code,409,'Used lesson frozen');
  assert.equal((await call('post','/courses/:id/publish',{},id)).code,200);
  assert.equal((await call('post','/courses/:id/lessons',{...lesson,sort_order:2},id)).code,409,'Published course frozen');
  assert.equal((await db.query('select is_published from lessons')).rows[0].is_published,true);
  await db.query('update courses set is_published=true where id=$1',[id]);
  assert.equal((await call('patch','/courses/:id',{title:'Forbidden'},id)).code,409);
  const listed = await call('get','/courses'); assert.equal(listed.body[0].title,'Renamed');
  const overview = await call('get','/overview');
  assert.equal(overview.body.courses,1); assert.equal(overview.body.published_courses,1);
  assert.equal(overview.body.lessons,1); assert.equal(overview.body.enrollments,0);
  assert.equal(overview.body.learners,2); assert.equal(overview.body.completed_lessons,0);
  assert.equal(overview.body.recent_courses[0].title,'Renamed');
  assert.ok(!JSON.stringify(overview.body).includes('email'), 'Overview exposes aggregates, not account details');
  assert.ok(admin.stack.filter(layer => !layer.route).length >= 3, 'Authentication and role middleware precede routes');
 } finally { delete globalThis.__adminSql; await db.close(); }
});
