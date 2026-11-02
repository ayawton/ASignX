import assert from 'node:assert/strict';
import { before,after,beforeEach,afterEach,test } from 'node:test';
import { readFile,readdir } from 'node:fs/promises';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { parseCourseText } from '../dist/courseImport.js';
import { courseTemplate,lessonsTemplate } from '../../client/src/data/courseTemplate.js';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const text='Course: Imported course\nDescription: A reviewed course\nLesson: Intro\nXP: 12\nContent: |\n  First line.\n  Second line.\nQuestion: choice | Choose one.\n* Correct\n- Other\nQuestion: boolean | Is this true?\nAnswer: false';
test('text templates parse multiline content, all answer types, CRLF and BOM',()=>{
 const plan=parseCourseText('\ufeff'+courseTemplate.replaceAll('\n','\r\n'));
 assert.equal(plan.lessons.length,2);assert.equal(plan.lessons[0].exercises[0].options[0].is_correct,true);
 assert.deepEqual(plan.lessons[0].exercises[1].options,[{option_text:'True',is_correct:true},{option_text:'False',is_correct:false}]);
 assert.equal(plan.lessons[1].exercises[0].target,'A');assert.deepEqual(plan.lessons[1].exercises[0].options,[]);
 assert.equal(parseCourseText(lessonsTemplate,'lessons').lessons.length,2);
 assert.equal(parseCourseText(text).lessons[0].content,'First line.\nSecond line.');
 assert.equal(parseCourseText('Course: Material\nLesson: Read\nContent: Plain text').lessons[0].xp_reward,10);
});
test('malformed imports report source lines and reject ambiguous or unsupported structures',()=>{
 for(const value of ['',text.replace('* Correct','- Correct'),text.replace('- Other','* Other'),text.replace('Question: choice','Question: text'),text.replace('XP: 12','XP: 1.5'),text.replace('XP: 12','XP: -1'),text.replace('Answer: false','Answer: maybe'),text.replace('Content: |','Contents: |'),text+'\nTarget: A',text+'\nAnswer: true',text+'\nLesson: No content'])assert.throws(()=>parseCourseText(value),/Line \d+:/);
 assert.throws(()=>parseCourseText('x'.repeat(100001)),/100 KB/);
 assert.throws(()=>parseCourseText(courseTemplate,'lessons'),/Omit Course/);
 assert.throws(()=>parseCourseText('Course: C\n'+Array.from({length:26},(_,i)=>`Lesson: ${i}\nContent: Read`).join('\n')),/25 lessons/);
 assert.throws(()=>parseCourseText('Course: C\nLesson: L\nContent: Read\n'+Array(11).fill('Question: boolean | True?\nAnswer: true').join('\n')),/10 questions/);
});
const db=new PGlite();let routes,admin,requireAdmin;
before(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`);
 for(const folder of (await readdir(new URL('../drizzle/',import.meta.url))).sort())await db.exec(await readFile(new URL(`../drizzle/${folder}/migration.sql`,import.meta.url),'utf8'));
 await db.exec(`insert into auth.users(id,email_confirmed_at) values ('${id(1)}',now()),('${id(2)}',now());update profiles set role='admin' where id='${id(1)}';insert into signs(id,gloss,meaning,is_published) values ('${id(3)}','A','Letter A',true),('${id(4)}','Hidden','Unpublished',false)`);
 globalThis.__importSql=async(parts,...values)=>(await db.query(parts.reduce((s,p,i)=>s+(i?`$${i}`:'')+p,''),values)).rows;
 globalThis.__importSql.begin=async callback=>{await db.exec('savepoint import_write');try{const result=await callback(globalThis.__importSql);await db.exec('release import_write');return result}catch(e){await db.exec('rollback to import_write;release import_write');throw e}};
 const bundle=await build({entryPoints:['src/admin.ts'],bundle:true,write:false,platform:'node',format:'esm',packages:'external',plugins:[{name:'import-db',setup(b){b.onResolve({filter:/^\.\/db\/index\.js$/},()=>({path:'db',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const connection=Object.assign((...args)=>globalThis.__importSql(...args),{begin:fn=>globalThis.__importSql.begin(fn)})'}))}}]});
 const source=bundle.outputFiles[0].text.replaceAll('from "express"',`from ${JSON.stringify(import.meta.resolve('express'))}`);
 ({admin,requireAdmin}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`));
 routes=admin.stack.find(l=>l.handle?.stack?.some(r=>r.route?.path==='/courses/import')).handle;
});
after(async()=>{delete globalThis.__importSql;await db.close()});beforeEach(()=>db.exec('begin'));afterEach(()=>db.exec('rollback'));
const scalar=async sql=>Object.values((await db.query(sql)).rows[0])[0];
const response=()=>({locals:{user:{id:id(1)}},code:200,status(code){this.code=code;return this},json(body){this.body=body;return this}});
async function call(path,body,course){const res=response();await routes.stack.find(l=>l.route?.path===path).route.stack[0].handle({params:course?{id:course}:{},body},res);return res}
test('imports stay behind the admin role guard and preview creates no data',async()=>{
 assert.ok(admin.stack.findIndex(l=>l.handle===requireAdmin)<admin.stack.findIndex(l=>l.handle===routes));
 const denied=response();denied.locals.user.id=id(2);await requireAdmin({},denied,()=>assert.fail('Learner permitted'));assert.equal(denied.code,403);
 const preview=await call('/courses/import/preview',{text});assert.equal(preview.code,200);assert.equal(preview.body.lessons[0].exercises.length,2);assert.equal(await scalar('select count(*) from courses'),0);
});
test('import saves an editable draft atomically, guards retries and appends in order',async()=>{
 const created=await call('/courses/import',{text,import_id:id(10)});assert.equal(created.code,201);assert.equal(created.body.lesson_count,1);
 assert.equal(await scalar('select is_published from courses'),false);assert.equal(await scalar('select is_published from lessons'),false);assert.equal(await scalar('select count(*) from exercise_options'),4);
 assert.equal((await call('/courses/import',{text,import_id:id(10)})).code,409);assert.equal(await scalar('select count(*) from courses'),1);
 const extra='Lesson: Added\nContent: More material';
 const appended=await call('/courses/:id/import',{text:extra,import_id:id(11)},id(10));assert.equal(appended.code,201);
 assert.equal(await scalar("select sort_order from lessons where title='Added'"),2);
 assert.equal((await call('/courses/:id/import',{text:extra,import_id:id(11)},id(10))).code,409);
 await db.exec('update lessons set is_published=true;update courses set is_published=true');
 assert.equal((await call('/courses/:id/import',{text:extra,import_id:id(12)},id(10))).code,409);
 await db.exec('update courses set is_published=false');
 assert.equal((await call('/courses/:id/import/preview',{text:extra},id(10))).code,409,'Archived course cannot receive imports');
});
test('camera imports link existing published signs and revalidate capabilities on save',async()=>{
 const original=globalThis.fetch,token=process.env.RECOGNITION_INTERNAL_TOKEN;
 try{
 process.env.RECOGNITION_INTERNAL_TOKEN='test';globalThis.fetch=async()=>Response.json({labels:['A'],model:'test',threshold:.8});
 const camera='Course: Camera\nLesson: Sign A\nContent: Read\nQuestion: recognition | Sign A\nTarget: a';
 const preview=await call('/courses/import/preview',{text:camera});assert.equal(preview.code,200);assert.deepEqual(preview.body.lessons[0].sign_labels,['A']);
 const created=await call('/courses/import',{text:camera,import_id:id(13)});assert.equal(created.code,201);assert.equal(await scalar('select sign_id from exercises'),id(3));assert.equal(await scalar('select count(*) from exercise_options'),0);assert.equal(await scalar('select count(*) from lesson_signs'),1);
 assert.equal((await call('/courses/import/preview',{text:camera.replace('Target: a','Target: Hidden')})).code,400);
 globalThis.fetch=async()=>Response.json({labels:['B'],model:'changed',threshold:.8});
 assert.equal((await call('/courses/import',{text:camera,import_id:id(14)})).code,400);assert.equal(await scalar('select count(*) from courses'),1);
 globalThis.fetch=async()=>{throw Error('offline')};assert.equal((await call('/courses/import/preview',{text:camera})).code,503);
 }finally{globalThis.fetch=original;if(token===undefined)delete process.env.RECOGNITION_INTERNAL_TOKEN;else process.env.RECOGNITION_INTERNAL_TOKEN=token}
});
test('a failed lesson insert rolls back the course and preceding lessons',async()=>{
 await db.exec(`create function public.fail_import() returns trigger language plpgsql as $$begin if new.title='Fail write' then raise exception 'Forced failure';end if;return new;end$$;create trigger fail_import before insert on lessons for each row execute function public.fail_import()`);
 await assert.rejects(call('/courses/import',{text:text+'\nLesson: Fail write\nContent: Read',import_id:id(15)}),/Forced failure/);
 assert.equal(await scalar('select count(*) from courses'),0);assert.equal(await scalar('select count(*) from lessons'),0);assert.equal(await scalar('select count(*) from exercises'),0);
});
