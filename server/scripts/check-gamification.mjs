// Live PostgreSQL-driver regression check. All fixture writes and rewards are rolled back.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import 'dotenv/config';
import { connection as sql } from '../dist/db/index.js';
const rollback=new Error('ROLLBACK_TEST_FIXTURES');let verified=false;
try{
 const bundle=await build({entryPoints:['src/gamification.ts'],bundle:true,write:false,platform:'node',format:'esm',packages:'external',plugins:[{name:'rollback-driver',setup(b){b.onResolve({filter:/^\.\/db\/index\.js$/},()=>({path:'db',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const connection=Object.assign((...args)=>globalThis.__liveTx(...args),{begin:fn=>fn(globalThis.__liveTx)})'}));}}]});
 const source=bundle.outputFiles[0].text.replaceAll('from "express"',`from ${JSON.stringify(import.meta.resolve('express'))}`);
 const {lessonAction,heartState,gamification}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
 try{await sql.begin(async tx=>{
  let queries=0;globalThis.__liveTx=(...args)=>{queries++;return tx(...args)};
  const [user]=await tx`select id from profiles where role='learner' limit 1`;
  if(!user)throw new Error('A learner profile is needed for the rollback check.');
  await heartState(tx,user.id);
  await tx`update learner_hearts set hearts=3,regenerated_at=now() where user_id=${user.id}`;
  assert.equal((await heartState(tx,user.id)).hearts,3);
  const course=randomUUID(),lesson=randomUUID(),enrollment=randomUUID(),exercise=randomUUID(),yes=randomUUID(),no=randomUUID(),run=randomUUID();
  await tx`insert into courses(id,title,is_published) values(${course},'Rollback-only driver check',true)`;
  await tx`insert into lessons(id,course_id,title,content,sort_order,xp_reward) values(${lesson},${course},'Rollback-only lesson','Test material',1,20)`;
  await tx`insert into exercises(id,lesson_id,prompt,sort_order,answer_type) values(${exercise},${lesson},'Choose true',1,'boolean')`;
  await tx`insert into exercise_options(id,exercise_id,option_text,is_correct,sort_order) values(${yes},${exercise},'True',true,1),(${no},${exercise},'False',false,2)`;
  await tx`update lessons set is_published=true where id=${lesson}`;
  await tx`insert into enrollments(id,user_id,course_id) values(${enrollment},${user.id},${course})`;
  const started=await lessonAction(user.id,lesson,'start',{start_id:run});assert.equal(started.status,200);assert.equal(started.body.run.id,run);
  queries=0;const answerStarted=performance.now();
  const answer=await lessonAction(user.id,lesson,'attempt',{run_id:run,attempt_id:randomUUID(),exercise_id:exercise,selected_option_id:yes});assert.equal(answer.status,200);assert.equal(answer.body.run.xp_earned,20);console.log(JSON.stringify({answerQueries:queries,answerMs:Math.round(performance.now()-answerStarted)}));
  await tx`update learner_hearts set hearts=0,regenerated_at=now() where user_id=${user.id}`;
  const call=async(path,body={})=>{const res={locals:{user:{id:user.id}},code:200,status(code){this.code=code;return this},json(body){this.body=body}};await gamification.stack.find(l=>l.route?.path===path).route.stack[0].handle({body},res);assert.equal(res.code,200);return res.body;};
  let result=await call('/heart-practice/start');const round=result.round.id;
  assert.equal(Number((await tx`select count(*) as n from heart_practice_questions where round_id=${round}`)[0].n),3);
  for(let i=0;i<3;i++){
   const [correct]=await tx`select id from exercise_options where exercise_id=${result.round.question.id} and is_correct limit 1`;
   result=await call('/heart-practice/answer',{round_id:round,attempt_id:randomUUID(),question_index:i,selected_option_id:correct.id});
  }
  assert.equal(result.hearts.hearts,1);assert.ok(result.round.completed_at);
  verified=true;throw rollback;
 });}catch(error){if(error!==rollback)throw error;}
 assert.ok(verified);
 console.log('PASS live driver: hearts, lesson start/grading and heart restoration; all fixture writes rolled back.');
}catch(error){console.error(JSON.stringify({checkFailed:true,code:error.code,message:error.message}));process.exitCode=1}
finally{delete globalThis.__liveTx;await sql.end()}
