import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('normalization preserves populated XP, practice submissions and recognition evidence',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`);
 const folders=(await readdir(new URL('../drizzle/',import.meta.url))).sort();
 const last=folders.pop();
 for(const folder of folders)await db.exec(await readFile(new URL(`../drizzle/${folder}/migration.sql`,import.meta.url),'utf8'));
 await db.exec(`insert into auth.users(id,email_confirmed_at) values ('${id(1)}',now());
 insert into courses(id,title,is_published) values ('${id(2)}','Existing course',true);
 insert into lessons(id,course_id,title,sort_order) values ('${id(3)}','${id(2)}','Existing lesson',1);
 insert into signs(id,gloss,meaning,is_published) values ('${id(4)}','A','Letter A',true);
 insert into lesson_signs values ('${id(3)}','${id(4)}',1);
 insert into exercises(id,lesson_id,prompt,sort_order,answer_type,sign_id) values ('${id(5)}','${id(3)}','Choose A',1,'choice',null),('${id(6)}','${id(3)}','Sign A',2,'recognition','${id(4)}');
 insert into exercise_options(id,exercise_id,option_text,is_correct,sort_order) values
 ('${id(7)}','${id(5)}','A',true,1),('${id(8)}','${id(5)}','B',false,2),('${id(9)}','${id(6)}','Recognized',true,1),('${id(10)}','${id(6)}','Not recognized',false,2);
 update lessons set is_published=true;
 insert into enrollments(id,user_id,course_id) values ('${id(11)}','${id(1)}','${id(2)}');
 insert into lesson_runs(id,enrollment_id,lesson_id,completed_at,xp_earned) values ('${id(12)}','${id(11)}','${id(3)}',now(),4);
 insert into lesson_progress(enrollment_id,lesson_id,completed_at) values ('${id(11)}','${id(3)}',now());
 alter table lesson_progress disable trigger user;
 update lesson_progress set xp_earned=10;
 alter table lesson_progress enable trigger user;
 insert into lesson_question_rewards(enrollment_id,exercise_id,xp_earned) values ('${id(11)}','${id(5)}',4);
 insert into exercise_attempts(id,enrollment_id,exercise_id,selected_option_id,is_correct,response_text,recognition_confidence,recognition_model) values ('${id(13)}','${id(11)}','${id(6)}','${id(9)}',true,'A',.99,'existing-model');
 insert into lesson_run_questions values ('${id(12)}','${id(6)}',5,1,'${id(13)}');`);
 // Include the historical double-encoded JSON form caused by the configured driver.
 await db.query('insert into heart_practice_rounds(id,user_id,questions,submissions,correct_count) values ($1,$2,$3::jsonb,$4::jsonb,1)',[id(14),id(1),JSON.stringify(JSON.stringify([id(5),id(5),id(5)])),JSON.stringify([{id:id(15),option:id(8),correct:false},{id:id(16),option:id(7),correct:true}])]);
 const migration=await readFile(new URL(`../drizzle/${last}/migration.sql`,import.meta.url),'utf8');
 await db.exec('begin;savepoint before_bad');
 await db.exec(`insert into courses(id,title) values ('${id(20)}','Other');insert into lessons(id,course_id,title,sort_order) values ('${id(21)}','${id(20)}','Other',1);update lesson_runs set lesson_id='${id(21)}';`);
 await assert.rejects(db.exec(migration),/Existing run relationships are inconsistent/);
 await db.exec('rollback to before_bad;commit;');
 await db.exec(`begin;${migration}commit;`);
 const scalar=async sql=>Object.values((await db.query(sql)).rows[0])[0];
 assert.equal(await scalar('select sum(amount)::int from xp_awards'),14);
 assert.equal(await scalar("select count(*)::int from xp_awards where source='claim' and amount=0"),1);
 assert.equal(await scalar('select count(*)::int from heart_practice_questions'),3);
 assert.equal(await scalar('select count(*)::int from heart_practice_submissions'),2);
 assert.equal(await scalar('select count(*)::int from heart_practice_submissions where is_correct'),1);
 assert.equal(await scalar("select fingerprint from model_versions m join exercise_attempts a on a.model_version_id=m.id"),'existing-model');
 assert.equal(await scalar('select selected_option_id from exercise_attempts'),null);
 assert.equal(await scalar(`select count(*)::int from exercise_options where exercise_id='${id(6)}'`),0);
 // Enrollment deletion must cascade through both new histories.
 await db.exec(`delete from auth.users where id='${id(1)}'`);
 assert.equal(await scalar('select count(*)::int from xp_awards'),0);
 assert.equal(await scalar('select count(*)::int from heart_practice_submissions'),0);
 }finally{await db.close()}
});
