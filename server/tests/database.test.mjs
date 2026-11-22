import assert from 'node:assert/strict';
import { before, after, beforeEach, afterEach, test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { build } from 'esbuild';

// Disposable PostgreSQL engine; never reads .env or connects to the user's database.
const db = new PGlite();
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const u1 = uid(1), u2 = uid(2), c1 = uid(10), c2 = uid(11), l1 = uid(20), l2 = uid(21);
const sign = uid(30), otherSign = uid(31), exercise = uid(40), correct = uid(50), wrong = uid(51);
const enrollment = uid(60), model = uid(70), session = uid(80), badge = uid(90);
const scalar = async sql => Object.values((await db.query(sql)).rows[0])[0];
const attempt = (option = correct, claimed = false) => `INSERT INTO exercise_attempts
    (enrollment_id,exercise_id,selected_option_id,is_correct) VALUES ('${enrollment}','${exercise}','${option}',${claimed})`;
const complete = () => `UPDATE lesson_progress SET completed_at=now() WHERE enrollment_id='${enrollment}'`;
test('media policies restrict uploads to admins and expose only published linked videos',async()=>{
 await db.exec(`create schema storage;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(bucket_id text,name text,metadata jsonb);
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon,authenticated;
  grant select,insert,delete on storage.objects to anon,authenticated;
  update profiles set role='admin' where id='${u1}';`);
 await db.exec(await readFile(new URL('../storage/learning-media.sql',import.meta.url),'utf8'));
 const path=`signs/${sign}/${uid(300)}.mp4`;
 await asUser(u2);
 await rejects(`insert into storage.objects values ('learning-media','${path}','{}')`,/row-level security/);
 await db.exec('reset role');await asUser(u1);
 await db.query('insert into storage.objects values ($1,$2,$3)',['learning-media',path,'{}']);
 assert.equal(await scalar('select count(*) from storage.objects'),1);
 await db.exec('reset role');await asUser(u2);
 assert.equal(await scalar('select count(*) from storage.objects'),0,'Unattached media stays private');
 await db.exec('reset role');await db.query('update signs set demo_path=$1 where id=$2',[path,sign]);await asUser(u2);
 assert.equal(await scalar('select count(*) from storage.objects'),1);
 await db.exec('reset role');await asUser(u1);
 await db.exec('delete from storage.objects');
 assert.equal(await scalar('select count(*) from storage.objects'),1,'Referenced media cannot be removed');
});
test('hearts, remaining question XP, perfect-run replays and heart practice are idempotent', async () => {
 let queries=0;globalThis.__lessonSql = async (parts,...values) => {queries++;return (await db.query(parts.reduce((s,p,i) => s+(i?`$${i}`:'')+p,''),values)).rows;};
 globalThis.__lessonSql.json=value=>JSON.stringify(value);
 globalThis.__lessonSql.begin = callback => callback(globalThis.__lessonSql);
 try {
  const bundle = await build({entryPoints:['src/personal.ts'],bundle:true,write:false,platform:'node',format:'esm',packages:'external',plugins:[{name:'test-db',setup(builder){
   builder.onResolve({filter:/^\.\/db\/index\.js$/},()=>({path:'db',namespace:'test'}));
   builder.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const connection = Object.assign((...args) => globalThis.__lessonSql(...args), {begin: fn => globalThis.__lessonSql.begin(fn)})'}));
  }}]});
  const source=bundle.outputFiles[0].text.replaceAll('from "express"',`from ${JSON.stringify(import.meta.resolve('express'))}`);
  const {personal}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const handler=personal.stack.find(layer=>layer.route?.path==='/lessons/:id/:action').route.stack[0].handle;
  async function call(action,body={},user=u1){const res={locals:{user:{id:user}},code:200,status(code){this.code=code;return this},json(body){this.body=body}};await handler({params:{id:l1,action},body},res);return res;}
  assert.equal((await call('start',{start_id:uid(200)},u2)).code,404);
  const start=await call('start',{start_id:uid(200)});assert.equal(start.body.hearts.hearts,3);
  assert.equal((await call('attempt',{run_id:uid(200),exercise_id:exercise,selected_option_id:correct,attempt_id:uid(299)},u2)).code,404);
  assert.equal((await call('attempt',{run_id:uid(200),exercise_id:exercise,selected_option_id:uid(999),attempt_id:uid(299)})).code,400);
  const wrongBody={run_id:uid(200),exercise_id:exercise,selected_option_id:wrong,attempt_id:uid(201)};
  const failed=await call('attempt',wrongBody);assert.equal(failed.body.hearts.hearts,2);assert.equal(failed.body.run.xp_earned,0);assert.ok(failed.body.run.completed_at);
  assert.equal((await call('attempt',wrongBody)).body.hearts.hearts,2);assert.equal(await scalar('select count(*) from exercise_attempts'),1);
  assert.equal((await call('attempt',{...wrongBody,attempt_id:uid(209),selected_option_id:correct})).code,409);
  await call('start',{start_id:uid(202)});
  queries=0;const perfect=await call('attempt',{run_id:uid(202),exercise_id:exercise,selected_option_id:correct,attempt_id:uid(203)});assert.equal(perfect.body.run.xp_earned,10);assert.equal(perfect.body.run.perfect,true);assert.ok(queries<=11,`Final-answer query budget exceeded: ${queries}`);
  assert.equal((await call('start',{start_id:uid(204)})).body.run.replay,true);
  const replay=await call('attempt',{run_id:uid(204),exercise_id:exercise,selected_option_id:correct,attempt_id:uid(205)});assert.equal(replay.body.run.xp_earned,2);
  assert.equal(await scalar('select sum(amount) from xp_awards'),12);
  await db.exec(`update learner_hearts set hearts=0,regenerated_at=now() where user_id='${u1}'`);
  assert.equal((await call('start',{start_id:uid(206)})).code,423);
  const game=personal.stack.find(l=>l.handle?.stack?.some(r=>r.route?.path==='/heart-practice/start')).handle;
  async function practice(path,body={}){const res={locals:{user:{id:u1}},code:200,status(code){this.code=code;return this},json(body){this.body=body}};await game.stack.find(l=>l.route?.path===path).route.stack[0].handle({body},res);return res;}
  const round=(await practice('/heart-practice/start')).body.round;let response;
  for(let i=0;i<3;i++)response=await practice('/heart-practice/answer',{round_id:round.id,attempt_id:uid(210+i),selected_option_id:correct,question_index:i});
  assert.equal(response.body.hearts.hearts,1);assert.equal(await scalar('select sum(amount) from xp_awards'),12);
  assert.equal((await practice('/heart-practice/answer',{round_id:round.id,attempt_id:uid(212),selected_option_id:correct,question_index:2})).body.hearts.hearts,1);
  await db.exec(`update learner_hearts set hearts=0,regenerated_at=now()-interval '625 seconds' where user_id='${u1}'`);
  const regenerated=(await practice('/hearts')).body;assert.equal(regenerated.hearts,2);assert.equal(new Date(regenerated.next_heart_at)-new Date(regenerated.server_time),275000);assert.equal((await practice('/hearts')).body.hearts,2,'Reading twice must retain fractional regeneration time');
  const multi=uid(600),q1=uid(601),q2=uid(602),q3=uid(603);
  await db.exec(`insert into lessons(id,course_id,title,content,sort_order,xp_reward) values ('${multi}','${c1}','Weighted','Study',9,100);
   insert into exercises(id,lesson_id,prompt,sort_order,answer_type) values ('${q1}','${multi}','One',1,'choice'),('${q2}','${multi}','Two',2,'choice'),('${q3}','${multi}','Three',3,'boolean');
   insert into exercise_options(id,exercise_id,option_text,is_correct,sort_order) values ('${uid(611)}','${q1}','Yes',true,1),('${uid(612)}','${q1}','No',false,2),('${uid(613)}','${q2}','Yes',true,1),('${uid(614)}','${q2}','No',false,2),('${uid(615)}','${q3}','True',true,1),('${uid(616)}','${q3}','False',false,2);
   update lessons set is_published=true where id='${multi}';update learner_hearts set hearts=3,regenerated_at=now();`);
  async function weighted(action,body){const res={locals:{user:{id:u1}},code:200,status(code){this.code=code;return this},json(body){this.body=body}};await handler({params:{id:multi,action},body},res);return res;}
  const rounds=[[611,614,615],[611,613,616],[611,613,615],[612,613,615]];
  const expected=[70,30,0,17];
  for(let i=0;i<rounds.length;i++){
   await db.exec(`update learner_hearts set hearts=3,regenerated_at=now() where user_id='${u1}'`);
   const run=uid(630+i);const started=await weighted('start',{start_id:run});assert.equal(started.body.run.replay,i===3);
   let result;for(let j=0;j<3;j++){queries=0;result=await weighted('attempt',{run_id:run,attempt_id:uid(650+i*3+j),exercise_id:[q1,q2,q3][j],selected_option_id:uid(rounds[i][j])});if(j<2)assert.ok(queries<=7,`Intermediate-answer query budget exceeded: ${queries}`);}
   assert.equal(result.body.run.xp_earned,expected[i]);assert.equal(result.body.run.perfect,i===2);
  }
  assert.equal(await scalar(`select sum(amount) from xp_awards where lesson_id='${multi}'`),117);
  await db.exec(`update learner_hearts set hearts=1,regenerated_at=now() where user_id='${u1}'`);
  const paused=uid(700);await weighted('start',{start_id:paused});
  const loss=await weighted('attempt',{run_id:paused,attempt_id:uid(701),exercise_id:q1,selected_option_id:uid(612)});assert.equal(loss.body.hearts.hearts,0);assert.equal(loss.body.run.completed_at,null);
  assert.equal((await weighted('attempt',{run_id:paused,attempt_id:uid(702),exercise_id:q2,selected_option_id:uid(613)})).code,423);
  await db.exec(`update learner_hearts set regenerated_at=now()-interval '301 seconds' where user_id='${u1}'`);
  assert.equal((await weighted('attempt',{run_id:paused,attempt_id:uid(702),exercise_id:q2,selected_option_id:uid(613)})).code,200);
  await db.exec(`delete from auth.users where id='${u1}'`);assert.equal(await scalar('select count(*) from lesson_runs'),0);assert.equal(await scalar(`select count(*) from learner_hearts where user_id='${u1}'`),0);


 } finally {delete globalThis.__lessonSql}
});
test('mixed answer types grade on server, keep keys private and save only trusted camera results',async()=>{
 const originalFetch=globalThis.fetch, token=process.env.RECOGNITION_INTERNAL_TOKEN;
 globalThis.__lessonSql=async(parts,...values)=>(await db.query(parts.reduce((s,p,i)=>s+(i?`$${i}`:'')+p,''),values)).rows;
 globalThis.__lessonSql.begin=callback=>callback(globalThis.__lessonSql);
 try{
  const lesson=uid(400),boolean=uid(402),camera=uid(403);
  await db.exec(`insert into lessons(id,course_id,title,content,sort_order) values ('${lesson}','${c1}','Mixed','Study',2);
   insert into lesson_signs values ('${lesson}','${sign}',1);
   insert into exercises(id,lesson_id,prompt,sort_order,answer_type,sign_id) values ('${boolean}','${lesson}','True?',2,'boolean',null),('${camera}','${lesson}','Sign A',3,'recognition','${sign}');
   insert into exercise_options(id,exercise_id,option_text,is_correct,sort_order) values
   ('${uid(412)}','${boolean}','True',true,1),('${uid(413)}','${boolean}','False',false,2);
   update lessons set is_published=true where id='${lesson}';`);
  const bundle=await build({entryPoints:['src/personal.ts'],bundle:true,write:false,platform:'node',format:'esm',packages:'external',plugins:[{name:'mixed-db',setup(b){b.onResolve({filter:/^\.\/db\/index\.js$/},()=>({path:'db',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const connection=Object.assign((...args)=>globalThis.__lessonSql(...args),{begin:fn=>globalThis.__lessonSql.begin(fn)})'}));}}]});
  const source=bundle.outputFiles[0].text.replaceAll('from "express"',`from ${JSON.stringify(import.meta.resolve('express'))}`);
  const {personal}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const response=(user=u1)=>({locals:{user:{id:user}},code:200,status(code){this.code=code;return this},json(body){this.body=body},end(){},setHeader(){}});
  let runId;
  async function action(action,body,user=u1){body=action==='start'?{start_id:uid(450),...body}:{run_id:runId,...body};const res=response(user);await personal.stack.find(l=>l.route?.path==='/lessons/:id/:action').route.stack[0].handle({params:{id:lesson,action},body},res);if(res.body?.run)runId=res.body.run.id;return res;}
  await action('start',{});
  assert.equal((await action('attempt',{attempt_id:uid(420),exercise_id:boolean,response_text:'True'})).code,400);
  assert.equal((await action('attempt',{attempt_id:uid(422),exercise_id:boolean,selected_option_id:uid(412)})).body.correct,true);
  assert.equal((await action('attempt',{attempt_id:uid(423),exercise_id:camera,selected_option_id:uid(414),correct:true})).code,400);
  assert.equal((await action('complete',{})).code,409);
  const get=response();await personal.stack.find(l=>l.route?.path==='/lessons/:id').route.stack[0].handle({params:{id:lesson}},get);
  assert.deepEqual(get.body.exercises.find(q=>q.answer_type==='recognition').options,[]);assert.ok(!JSON.stringify(get.body).includes('Not recognized'));
  process.env.RECOGNITION_INTERNAL_TOKEN='internal-test';let detected='B';
  globalThis.fetch=async(url,options)=>{assert.equal(options.headers['X-Recognition-Key'],'internal-test');if(url.endsWith('/capabilities'))return Response.json({labels:['A','B'],model:'model-test',threshold:.8});if(url.endsWith('/sessions'))return Response.json({session_id:'a'.repeat(43)});if(url.endsWith('/frames'))return Response.json({emissions:[{label:detected,confidence:.95}]});return new Response(null,{status:204});};
  const router=personal.stack.find(l=>l.handle?.stack?.some(r=>r.route?.path==='/lessons/:id/recognition')).handle;
  const create=router.stack.find(l=>l.route?.path==='/lessons/:id/recognition').route.stack[0].handle;
  const denied=response(u2);await create({params:{id:lesson},body:{exercise_id:camera,run_id:runId}},denied);assert.equal(denied.code,404);
  const started=response();await create({params:{id:lesson},body:{exercise_id:camera,run_id:runId}},started);assert.ok(started.body.session_id);
  const sessionMiddleware=router.stack.find(l=>!l.route).handle;
  const stolen=response(u2);await sessionMiddleware({params:{session:started.body.session_id}},stolen,()=>assert.fail('foreign camera session accepted'));assert.equal(stolen.code,404);
  async function frame(){const res=response();await sessionMiddleware({params:{session:started.body.session_id}},res,()=>{});await router.stack.find(l=>l.route?.path==='/lesson-recognition/:session/frames').route.stack.at(-1).handle({body:Buffer.from('test JPEG forwarded to trusted mock'),is:()=>true,get:()=> '1000'},res);return res;}
  assert.equal((await frame()).body.correct,false);detected='A';assert.equal((await frame()).body.correct,true);
  assert.equal(await scalar(`select m.fingerprint from exercise_attempts a join model_versions m on m.id=a.model_version_id where exercise_id='${camera}' and is_correct`),'model-test');
  assert.equal((await action('complete',{})).code,200);
 }finally{globalThis.fetch=originalFetch;if(token===undefined)delete process.env.RECOGNITION_INTERNAL_TOKEN;else process.env.RECOGNITION_INTERNAL_TOKEN=token;delete globalThis.__lessonSql;}
});
const practice = (score = '.9', prediction = `'${sign}'`, time = 'now()') => `INSERT INTO practice_attempts
    (user_id,target_sign_id,predicted_sign_id,model_version_id,confidence,is_correct,attempted_at)
    VALUES ('${u1}','${sign}',${prediction},'${model}',${score},true,${time})`;
async function rejects(sql, pattern) {
    await db.exec('SAVEPOINT expected_failure');
    await assert.rejects(db.exec(sql), pattern);
    await db.exec('ROLLBACK TO SAVEPOINT expected_failure');
}
async function asUser(user = u1, role = 'authenticated') {
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [user]);
    await db.exec(`SET LOCAL ROLE ${role}`);
}

before(async () => {
    // Only the Supabase-managed prerequisites are stubbed in this local engine.
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
        CREATE SCHEMA auth;
        CREATE TABLE auth.users (id uuid PRIMARY KEY, raw_user_meta_data jsonb DEFAULT '{}', email_confirmed_at timestamptz);
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
        GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;`);
    for (const folder of (await readdir(new URL('../drizzle/', import.meta.url))).sort()) {
        const path = new URL(`../drizzle/${folder}/migration.sql`, import.meta.url);
        const sql = await readFile(path, 'utf8');
        await db.exec(`BEGIN; ${sql} COMMIT;`);
    }
    await db.exec(`INSERT INTO auth.users(id,raw_user_meta_data,email_confirmed_at) VALUES
        ('${u1}','{"display_name":"Learner one","role":"admin"}',now()),('${u2}','{"display_name":"Learner two"}',now());
        INSERT INTO courses(id,title,is_published) VALUES ('${c1}','Alphabet',true),('${c2}','Draft',false);
        INSERT INTO lessons(id,course_id,title,sort_order) VALUES
            ('${l1}','${c1}','Letter A',1),('${l2}','${c2}','Hidden lesson',1);
        INSERT INTO signs(id,gloss,meaning,is_published) VALUES
            ('${sign}','A','Letter A',true),('${otherSign}','B','Letter B',false);
        INSERT INTO lesson_signs VALUES ('${l1}','${sign}',1);
        INSERT INTO exercises(id,lesson_id,prompt,sort_order) VALUES ('${exercise}','${l1}','Choose A',1);
        INSERT INTO exercise_options(id,exercise_id,option_text,is_correct,sort_order) VALUES
            ('${correct}','${exercise}','A',true,1),('${wrong}','${exercise}','B',false,2);
        UPDATE lessons SET is_published=true WHERE id IN ('${l1}','${l2}');
        INSERT INTO enrollments(id,user_id,course_id) VALUES ('${enrollment}','${u1}','${c1}');
        INSERT INTO lesson_progress(enrollment_id,lesson_id) VALUES ('${enrollment}','${l1}');
        INSERT INTO model_versions(id,version,artifact_path) VALUES ('${model}','v1','models/v1.onnx');
        INSERT INTO recognition_sessions(id,user_id) VALUES ('${session}','${u1}');
        INSERT INTO achievements(id,code,name,description,metric,threshold) VALUES
            ('${badge}','FIRST','First lesson','Complete one lesson','completed_lessons',1);`);
});
after(async () => { await db.close(); });
beforeEach(async () => { await db.exec('BEGIN'); });
afterEach(async () => { await db.exec('ROLLBACK'); });

test('migration replaces both practice tables with exactly 23 RLS-protected application tables', async () => {
    const { rows } = await db.query("SELECT relname,relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND relkind='r'");
    assert.equal(rows.length, 23);
    assert.ok(rows.every(r => r.relrowsecurity));
    assert.ok(!rows.some(r => ['departments', 'subjects'].includes(r.relname)));
});
test('already-confirmed signup creates a learner profile and ignores requested admin metadata', async () => {
    assert.equal(await scalar(`SELECT role FROM profiles WHERE id='${u1}'`), 'learner');
});
test('profiles reject invalid timezones', async () => {
    await rejects(`UPDATE profiles SET timezone='Invalid/Zone' WHERE id='${u1}'`, /Invalid IANA timezone/);
});
test('anonymous readers see only published content, including the parent course', async () => {
    await asUser('', 'anon');
    assert.equal(await scalar('SELECT count(*)::int FROM courses'), 1);
    assert.equal(await scalar('SELECT count(*)::int FROM lessons'), 1);
    assert.equal(await scalar('SELECT count(*)::int FROM signs'), 1);
    assert.equal(await scalar('SELECT count(*)::int FROM exercises'), 1);
});
test('learners can read only their own progress, profile and Live history', async () => {
    await asUser(u2);
    assert.equal(await scalar('SELECT count(*)::int FROM profiles'), 1);
    assert.equal(await scalar('SELECT count(*)::int FROM enrollments'), 0);
    assert.equal(await scalar('SELECT count(*)::int FROM lesson_progress'), 0);
    assert.equal(await scalar('SELECT count(*)::int FROM recognition_sessions'), 0);
});
test('owner can edit allowed profile fields but cannot promote their role', async () => {
    await asUser();
    await db.exec(`UPDATE profiles SET display_name='Updated',timezone='Asia/Manila' WHERE id='${u1}'`);
    assert.equal(await scalar(`SELECT display_name FROM profiles WHERE id='${u1}'`), 'Updated');
    await rejects(`UPDATE profiles SET role='admin' WHERE id='${u1}'`, /permission denied/);
});
test('browser cannot read answer keys or model artifact paths or write trusted outcomes', async () => {
    await asUser();
    await rejects('SELECT * FROM exercise_options', /permission denied/);
    await rejects('SELECT * FROM model_versions', /permission denied/);
    await rejects(complete(), /permission denied/);
    await rejects(practice(), /permission denied/);
});
test('grading uses stored option correctness and verifies course membership', async () => {
    await db.exec(attempt(wrong, true));
    assert.equal(await scalar('SELECT is_correct FROM exercise_attempts'), false);
    await rejects(`INSERT INTO exercise_attempts(enrollment_id,exercise_id,selected_option_id,is_correct)
        VALUES ('${enrollment}','${exercise}','${uid(999)}',true)`, /Option does not belong/);
    await rejects(`INSERT INTO lesson_progress(enrollment_id,lesson_id) VALUES ('${enrollment}','${l2}')`, /does not belong/);
});
test('completion requires a finalized run and preserves its timestamp', async () => {
 await db.exec(attempt());
 await rejects(complete(), /finalized lesson run/);
 await db.exec(`insert into lesson_runs(id,enrollment_id,lesson_id,completed_at) values ('${uid(901)}','${enrollment}','${l1}',now())`);
 await db.exec(complete());
 await rejects(`UPDATE lesson_progress SET completed_at=completed_at+interval '1 second'`, /immutable/);
 await rejects('DELETE FROM lesson_progress', /cannot be deleted/);
});

test('practice uses the immutable model threshold and rejects out-of-range scores', async () => {
    await db.exec(practice('.79'));
    assert.equal(await scalar('SELECT is_correct FROM practice_attempts'), false);
    await db.exec(practice('.95'));
    assert.equal(await scalar('SELECT count(*)::int FROM practice_attempts WHERE is_correct'), 1);
    await db.exec(practice('.99', 'NULL'));
    assert.equal(await scalar('SELECT count(*)::int FROM practice_attempts WHERE is_correct'), 1);
    await rejects(practice('1.1'), /violates check constraint/);
    await rejects("UPDATE model_versions SET confidence_threshold='.1'", /immutable/);
});
test('lesson practice requires target membership and enrollment', async () => {
    await rejects(`INSERT INTO practice_attempts(user_id,lesson_id,target_sign_id,model_version_id,confidence,is_correct)
        VALUES ('${u1}','${l1}','${otherSign}','${model}',.9,true)`, /requires enrollment/);
    await rejects(`INSERT INTO practice_attempts(user_id,lesson_id,target_sign_id,model_version_id,confidence,is_correct)
        VALUES ('${u2}','${l1}','${sign}','${model}',.9,true)`, /requires enrollment/);
});
test('published quiz definitions cannot be silently changed', async () => {
    await rejects(`UPDATE exercise_options SET option_text='Replaced' WHERE id='${correct}'`, /definitions are frozen/);
    await rejects(`UPDATE exercises SET prompt='Replaced' WHERE id='${exercise}'`, /definitions are frozen/);
});
test('publication rejects missing choices or no correct choice', async () => {
    await db.exec(`UPDATE lessons SET is_published=false WHERE id='${l2}';
        INSERT INTO exercises(lesson_id,prompt,sort_order) VALUES ('${l2}','Incomplete question',1);
        UPDATE lessons SET is_published=true WHERE id='${l2}'`);
    await rejects('SET CONSTRAINTS ALL IMMEDIATE', /question configuration is invalid/);
});
test('only one option per exercise can be correct', async () => {
    await db.exec(`UPDATE lessons SET is_published=false WHERE id='${l1}'`);
    await rejects(`UPDATE exercise_options SET is_correct=true WHERE id='${wrong}'`, /duplicate key/);
});
test('Live final text uses ordered, accepted predictions and rejects later appends', async () => {
    await db.exec(`INSERT INTO recognition_results(session_id,sign_id,model_version_id,sequence_no,confidence) VALUES
        ('${session}','${sign}','${model}',2,.9),('${session}','${otherSign}','${model}',1,.9),
        ('${session}','${sign}','${model}',3,.3),('${session}',NULL,'${model}',4,.99);
        UPDATE recognition_sessions SET ended_at=now(),final_text='Client fake text' WHERE id='${session}'`);
    assert.equal(await scalar('SELECT final_text FROM recognition_sessions'), 'Letter B Letter A');
    await rejects(`INSERT INTO recognition_results(session_id,model_version_id,sequence_no,confidence)
        VALUES ('${session}','${model}',5,.9)`, /ended recognition session/);
});
test('achievement awards require eligibility and cannot be duplicated or redefined', async () => {
    await rejects(`INSERT INTO user_achievements(user_id,achievement_id) VALUES ('${u1}','${badge}')`, /threshold has not been met/);
    await db.exec(attempt()); await db.exec(`insert into lesson_runs(enrollment_id,lesson_id,completed_at) values ('${enrollment}','${l1}',now())`); await db.exec(complete());
    await db.exec(`INSERT INTO user_achievements(user_id,achievement_id) VALUES ('${u1}','${badge}')`);
    await rejects(`INSERT INTO user_achievements(user_id,achievement_id) VALUES ('${u1}','${badge}')`, /duplicate key/);
    await rejects("UPDATE achievements SET threshold=2", /immutable/);
});
test('streak combines local dates, counts a date once and resets after a gap', async () => {
    await db.exec(practice()); await db.exec(practice());
    assert.equal(await scalar(`SELECT asignx_private.current_streak('${u1}')`), 1);
    await db.exec(practice('.9', `'${sign}'`, "now()-interval '1 day'"));
    await db.exec(practice('.9', `'${sign}'`, "now()-interval '3 days'"));
    assert.equal(await scalar(`SELECT asignx_private.current_streak('${u1}')`), 2);
    await db.exec('DELETE FROM practice_attempts');
    await db.exec(practice('.9', `'${sign}'`, "now()-interval '3 days'"));
    assert.equal(await scalar(`SELECT asignx_private.current_streak('${u1}')`), 0);
});
test('account deletion cascades private activity but preserves shared content', async () => {
    await db.exec(attempt()); await db.exec(`insert into lesson_runs(enrollment_id,lesson_id,completed_at) values ('${enrollment}','${l1}',now())`); await db.exec(complete()); await db.exec(practice());
    await db.exec(`DELETE FROM auth.users WHERE id='${u1}'`);
    for (const name of ['enrollments','lesson_progress','exercise_attempts','practice_attempts','recognition_sessions']) {
        assert.equal(await scalar(`SELECT count(*)::int FROM ${name}`), 0, name);
    }
    assert.equal(await scalar('SELECT count(*)::int FROM courses'), 2);
    assert.equal(await scalar('SELECT count(*)::int FROM model_versions'), 1);
});

test('legacy replacement guard handles absent tables and refuses populated tables', async () => {
    const migration = await readFile(new URL('../drizzle/20261021161839_asignx_application/migration.sql', import.meta.url), 'utf8');
    const guard = migration.split('--> statement-breakpoint')[0];
    await db.exec(guard);
    await db.exec('CREATE TABLE departments(id integer); INSERT INTO departments VALUES (1)');
    await rejects(guard, /Legacy departments\/subjects contain data/);
    await db.exec('DROP TABLE departments; CREATE TABLE subjects(id integer); INSERT INTO subjects VALUES (1)');
    await rejects(guard, /Legacy departments\/subjects contain data/);
    await db.exec('DELETE FROM subjects');
    await db.exec(guard);
});

test('pending signup creates no profile; verification creates exactly one learner profile', async () => {
    const pending = uid(300);
    await db.exec(`INSERT INTO auth.users(id,raw_user_meta_data) VALUES ('${pending}','{"display_name":"Pending learner","role":"admin"}')`);
    assert.equal(await scalar(`SELECT count(*)::int FROM profiles WHERE id='${pending}'`), 0);
    await rejects(`INSERT INTO profiles(id,display_name) VALUES ('${pending}','Bypass attempt')`, /Email must be confirmed/);
    await db.exec(`UPDATE auth.users SET raw_user_meta_data='{"display_name":"Updated pending name","role":"admin"}' WHERE id='${pending}'`);
    assert.equal(await scalar(`SELECT count(*)::int FROM profiles WHERE id='${pending}'`), 0);
    await db.exec(`UPDATE auth.users SET email_confirmed_at=now() WHERE id='${pending}'`);
    const { rows } = await db.query(`SELECT display_name,role FROM profiles WHERE id='${pending}'`);
    assert.deepEqual(rows, [{ display_name: 'Updated pending name', role: 'learner' }]);
    await db.exec(`UPDATE profiles SET display_name='Saved profile name',timezone='Asia/Manila' WHERE id='${pending}'; UPDATE auth.users SET email_confirmed_at=now() WHERE id='${pending}'`);
    assert.equal(await scalar(`SELECT count(*)::int FROM profiles WHERE id='${pending}'`), 1);
    assert.equal(await scalar(`SELECT display_name FROM profiles WHERE id='${pending}'`), 'Saved profile name');
    assert.equal(await scalar(`SELECT timezone FROM profiles WHERE id='${pending}'`), 'Asia/Manila');
});

test('pending signup can be deleted without ever creating a profile', async () => {
    const pending = uid(301);
    await db.exec(`INSERT INTO auth.users(id) VALUES ('${pending}'); DELETE FROM auth.users WHERE id='${pending}'`);
    assert.equal(await scalar(`SELECT count(*)::int FROM profiles WHERE id='${pending}'`), 0);
});

test('upgrade removes empty pending profiles, preserves confirmed profiles, and refuses to erase activity', async () => {
    const upgradeDb = new PGlite();
    try {
        await upgradeDb.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
            CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb DEFAULT '{}',email_confirmed_at timestamptz);
            CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
            GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
            GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;`);
        const folders = (await readdir(new URL('../drizzle/', import.meta.url))).sort();
        for (const folder of folders.filter(name => !name.endsWith('_confirmed_profiles'))) {
            await upgradeDb.exec(await readFile(new URL(`../drizzle/${folder}/migration.sql`, import.meta.url), 'utf8'));
        }
        const pending = uid(310), confirmed = uid(311), activePending = uid(312);
        await upgradeDb.exec(`INSERT INTO auth.users(id,email_confirmed_at) VALUES ('${pending}',null),('${confirmed}',now());
            UPDATE profiles SET display_name='Keep my profile',role='admin',timezone='Asia/Manila' WHERE id='${confirmed}'`);
        const migration = await readFile(new URL('../drizzle/20261022172738_confirmed_profiles/migration.sql', import.meta.url), 'utf8');
        await upgradeDb.exec(`BEGIN; INSERT INTO auth.users(id) VALUES ('${activePending}');
            INSERT INTO recognition_sessions(user_id) VALUES ('${activePending}'); SAVEPOINT before_migration;`);
        await assert.rejects(upgradeDb.exec(migration), /Unconfirmed profiles have saved activity/);
        await upgradeDb.exec('ROLLBACK TO SAVEPOINT before_migration');
        assert.equal((await upgradeDb.query(`SELECT count(*)::int AS n FROM recognition_sessions WHERE user_id='${activePending}'`)).rows[0].n, 1);
        await upgradeDb.exec('ROLLBACK');
        await upgradeDb.exec(`BEGIN; ${migration} COMMIT;`);
        assert.equal((await upgradeDb.query(`SELECT count(*)::int AS n FROM profiles WHERE id='${pending}'`)).rows[0].n, 0);
        assert.equal((await upgradeDb.query(`SELECT count(*)::int AS n FROM auth.users WHERE id='${pending}'`)).rows[0].n, 1);
        assert.deepEqual((await upgradeDb.query(`SELECT display_name,role,timezone FROM profiles WHERE id='${confirmed}'`)).rows,
            [{ display_name: 'Keep my profile', role: 'admin', timezone: 'Asia/Manila' }]);
        await upgradeDb.exec(`UPDATE auth.users SET email_confirmed_at=now() WHERE id='${pending}'`);
        assert.equal((await upgradeDb.query(`SELECT count(*)::int AS n FROM profiles WHERE id='${pending}'`)).rows[0].n, 1);
    } finally { await upgradeDb.close(); }
});


test('normalized histories enforce run ownership, question membership and award uniqueness',async()=>{
 const run=uid(950);
 await rejects(`insert into lesson_runs(enrollment_id,lesson_id) values ('${enrollment}','${l2}')`,/Run enrollment lesson mismatch/);
 await db.exec(`insert into lesson_runs(id,enrollment_id,lesson_id) values ('${run}','${enrollment}','${l1}')`);
 await db.exec(`update lessons set is_published=false where id='${l2}';insert into exercises(id,lesson_id,prompt,sort_order) values ('${uid(951)}','${l2}','Other',1)`);
 await rejects(`insert into lesson_run_questions(run_id,exercise_id,xp_value,sort_order) values ('${run}','${uid(951)}',10,1)`,/Run question lesson mismatch/);
 await db.exec(attempt());
 await db.exec(`insert into enrollments(id,user_id,course_id) values ('${uid(952)}','${u2}','${c1}');insert into exercise_attempts(id,enrollment_id,exercise_id,selected_option_id,is_correct) values ('${uid(953)}','${uid(952)}','${exercise}','${correct}',false)`);
 await rejects(`insert into lesson_run_questions(run_id,exercise_id,xp_value,sort_order,attempt_id) values ('${run}','${exercise}',10,1,'${uid(953)}')`,/Run answer ownership mismatch/);
 await rejects(`insert into xp_awards(enrollment_id,lesson_id,run_id,source,amount) values ('${enrollment}','${l2}','${run}','replay',10)`,/XP award relationship mismatch/);
 await db.exec(`insert into xp_awards(enrollment_id,lesson_id,run_id,exercise_id,source,amount) values ('${enrollment}','${l1}','${run}','${exercise}','first_question',10)`);
 await rejects(`insert into xp_awards(enrollment_id,lesson_id,exercise_id,source,amount) values ('${enrollment}','${l1}','${exercise}','claim',0)`,/duplicate key/);
 await rejects('update xp_awards set amount=100',/immutable/);
 const round=uid(954);
 await db.exec(`insert into heart_practice_rounds(id,user_id) values ('${round}','${u1}');insert into heart_practice_questions values ('${round}',0,'${exercise}')`);
 await rejects(`insert into heart_practice_submissions values ('${uid(955)}','${round}',0,'${uid(999)}',true,now())`,/Heart answer does not belong/);
 await db.exec(`insert into heart_practice_submissions values ('${uid(956)}','${round}',0,'${wrong}',true,now())`);
 assert.equal(await scalar('select is_correct from heart_practice_submissions'),false);
 await asUser(u1);
 for(const table of ['xp_awards','heart_practice_questions','heart_practice_submissions'])await rejects(`select * from ${table}`,/permission denied/);
});
