import { Router } from 'express';
import type { TransactionSql } from 'postgres';
import { connection } from './db/index.js';
import { learnerConnection } from './db/learnerConnection.js';
const sql = learnerConnection(connection);
type Tx=TransactionSql<{}>;
const HEART_REGEN_SECONDS=30*60;
const HEART_REGEN_MS=HEART_REGEN_SECONDS*1000;
export const validUuid=(v:unknown):v is string=>typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function allocateXp(questions:{id:string;answer_type:string}[],total:number){
 const weights:Record<string,number>={choice:3,boolean:2,recognition:5};const counts:Record<string,number>={};
 for(const q of questions)counts[q.answer_type]=(counts[q.answer_type]??0)+1;
 const sum=Object.keys(counts).reduce((s,k)=>s+(weights[k]??0),0);
 const rows=questions.map((q,index)=>{const exact=total*(weights[q.answer_type]??0)/(sum*(counts[q.answer_type]??1));return {...q,index,value:Math.floor(exact),fraction:exact-Math.floor(exact)};});
 let remaining=total-rows.reduce((s,q)=>s+q.value,0);
 for(const row of [...rows].sort((a,b)=>b.fraction-a.fraction || a.index-b.index)){if(remaining--<=0)break;row.value++;}
 return rows;
}
function heartView(state:Record<string,any>){
 const now=new Date(state.server_now).getTime();
 return {regen_interval_seconds:HEART_REGEN_SECONDS,hearts:Number(state.hearts),next_heart_at:state.hearts<3?new Date(new Date(state.regenerated_at).getTime()+HEART_REGEN_MS).toISOString():null,server_time:new Date(now).toISOString()};
}
export async function heartState(tx:Tx,user:string){
 // One atomic upsert both locks the learner and applies elapsed regeneration.
 const [state]=await tx`insert into learner_hearts as h(user_id) values(${user}) on conflict(user_id) do update set
 hearts=least(3,h.hearts+greatest(0,floor(extract(epoch from (now()-h.regenerated_at))/${HEART_REGEN_SECONDS}))::int),
 regenerated_at=case when h.hearts+greatest(0,floor(extract(epoch from (now()-h.regenerated_at))/${HEART_REGEN_SECONDS}))>=3 then now()
 else h.regenerated_at+greatest(0,floor(extract(epoch from (now()-h.regenerated_at))/${HEART_REGEN_SECONDS}))*make_interval(secs => ${HEART_REGEN_SECONDS}) end
 returning hearts,regenerated_at,now() as server_now`;
 if(!state)throw new Error('Heart account unavailable');
 return heartView(state);
}
export async function runView(tx:Tx,id:string,user:string):Promise<(Record<string,any>&{questions:Record<string,any>[]})|null>{
 const [run]=await tx`select r.*,(select coalesce(sum(a.amount),0)::int from xp_awards a where a.run_id=r.id) as xp_earned,
 (select coalesce(jsonb_agg(jsonb_build_object('exercise_id',q.exercise_id,'xp_value',q.xp_value,'sort_order',q.sort_order,'answered',q.attempt_id is not null,
 'correct',a.is_correct,'selected_option_id',case when x.answer_type='recognition' then null else a.selected_option_id end,
 'response_text',a.response_text,'recognition_confidence',a.recognition_confidence::text) order by q.sort_order),'[]'::jsonb)
 from lesson_run_questions q join exercises x on x.id=q.exercise_id left join exercise_attempts a on a.id=q.attempt_id where q.run_id=r.id) as questions
 from lesson_runs r join enrollments e on e.id=r.enrollment_id where r.id=${id} and e.user_id=${user}`;
 return run?run as Record<string,any>&{questions:Record<string,any>[]}:null;
}
export async function activeRun(tx:Tx,lesson:string,user:string){
 const [run]=await tx`select r.id from lesson_runs r join enrollments e on e.id=r.enrollment_id where r.lesson_id=${lesson} and e.user_id=${user} order by (r.completed_at is null) desc,r.started_at desc,r.id desc limit 1`;
 return run?runView(tx,run.id,user):null;
}
async function finishRun(tx:Tx,run:Record<string,any>,user:string){
 const questions=await tx`select q.*,a.is_correct from lesson_run_questions q left join exercise_attempts a on a.id=q.attempt_id where q.run_id=${run.id} order by q.sort_order`;
 if(questions.some(q=>!q.attempt_id))return;
 let xp=0;
 if(run.replay)xp=Math.floor(questions.filter(q=>q.is_correct).reduce((s,q)=>s+q.xp_value,0)*.25);
 else {
  const claimed=await tx`insert into xp_awards(enrollment_id,lesson_id,run_id,exercise_id,source,amount)
  select ${run.enrollment_id},${run.lesson_id},q.run_id,q.exercise_id,'first_question',q.xp_value
  from lesson_run_questions q join exercise_attempts a on a.id=q.attempt_id where q.run_id=${run.id} and a.is_correct on conflict do nothing returning amount`;
  xp=claimed.reduce((sum,row)=>sum+row.amount,0);
 }
 const perfect=questions.length>0 && questions.every(q=>q.is_correct);
 if(!questions.length){const [p]=await tx`select completed_at from lesson_progress where enrollment_id=${run.enrollment_id} and lesson_id=${run.lesson_id}`;if(!p?.completed_at){const [l]=await tx`select xp_reward from lessons where id=${run.lesson_id}`;xp=l?.xp_reward??0;}}
 if(run.replay || !questions.length)await tx`insert into xp_awards(enrollment_id,lesson_id,run_id,source,amount) values(${run.enrollment_id},${run.lesson_id},${run.id},${run.replay?'replay':'material'},${xp}) on conflict do nothing`;
 await tx`update lesson_runs set completed_at=now(),perfect=${perfect} where id=${run.id} and completed_at is null`;
 await tx`update lesson_progress set completed_at=now() where enrollment_id=${run.enrollment_id} and lesson_id=${run.lesson_id} and completed_at is null`;
 if(perfect)await tx`update lesson_progress set perfected_at=coalesce(perfected_at,now()) where enrollment_id=${run.enrollment_id} and lesson_id=${run.lesson_id}`;
}
export async function recordRunAnswer(tx:Tx,user:string,runId:string,exercise:string,optionId:string|null,attemptId:string,evidence?:{label:string;confidence:string},lesson?:string){
 let hearts=await heartState(tx,user);
 const [run]=await tx`select r.* from lesson_runs r join enrollments e on e.id=r.enrollment_id join lessons l on l.id=r.lesson_id join courses c on c.id=l.course_id where r.id=${runId} and e.user_id=${user} and l.is_published and c.is_published and (${lesson??null}::uuid is null or r.lesson_id=${lesson??null}::uuid) for update of r for share of l,c,e`;
 if(!run)return {status:404,body:{error:'Lesson attempt unavailable.'}};
 const [q]=await tx`select q.*,x.answer_type,(select count(*)::int from lesson_run_questions pending where pending.run_id=q.run_id and pending.attempt_id is null) as unanswered,(select exercise_id from lesson_run_questions pending where pending.run_id=q.run_id and pending.attempt_id is null order by sort_order limit 1) as next_exercise_id,a.id as saved_id,a.selected_option_id,a.is_correct from lesson_run_questions q join exercises x on x.id=q.exercise_id left join exercise_attempts a on a.id=q.attempt_id where q.run_id=${runId} and q.exercise_id=${exercise}`;
 if(!q)return {status:400,body:{error:'Question does not belong to this attempt.'}};
 if(q.saved_id){if(q.saved_id!==attemptId || q.selected_option_id!==optionId)return {status:409,body:{error:'This question is already answered.'}};return {status:200,body:{correct:q.is_correct,hearts,run:await runView(tx,runId,user)}};}
 if(run.completed_at)return {status:409,body:{error:'This attempt is complete. Start another from the results.'}};
 if(q.next_exercise_id!==exercise)return {status:409,body:{error:'Answer the current question first.'}};
 if(hearts.hearts===0)return {status:423,body:{error:'No hearts left. Review material or restore a heart to resume.',hearts}};
 if((q.answer_type==='recognition')!==Boolean(evidence))return {status:400,body:{error:'Use the required answer control.'}};
 let [saved]=await tx`insert into exercise_attempts(id,enrollment_id,exercise_id,selected_option_id,response_text,recognition_confidence,is_correct) select ${attemptId},${run.enrollment_id},${exercise},${optionId},${evidence?.label??null},${evidence?.confidence??null},false where ${Boolean(evidence)} or exists(select 1 from exercise_options where id=${optionId} and exercise_id=${exercise}) on conflict(id) do nothing returning id,is_correct`;
 if(!saved)[saved]=await tx`select id,is_correct from exercise_attempts where id=${attemptId} and enrollment_id=${run.enrollment_id} and exercise_id=${exercise} and selected_option_id is not distinct from ${optionId}`;
 if(!saved){const [collision]=await tx`select id from exercise_attempts where id=${attemptId}`;return {status:collision?409:400,body:{error:collision?'Submission ID already used.':'Answer choice unavailable.'}};}
 // Camera mismatch feedback is heart-free and does not finalize that question.
 if(!evidence || saved.is_correct)await tx`update lesson_run_questions set attempt_id=${saved.id} where run_id=${runId} and exercise_id=${exercise} and attempt_id is null`;
 if(!evidence && !saved.is_correct){const [state]=await tx`update learner_hearts set regenerated_at=case when hearts=3 then now() else regenerated_at end,hearts=hearts-1 where user_id=${user} returning hearts,regenerated_at,now() as server_now`;hearts=heartView(state!);}
 if(q.unanswered===1 && (!evidence || saved.is_correct))await finishRun(tx,run,user);
 return {status:200,body:{correct:saved.is_correct,hearts,run:await runView(tx,runId,user)}};
}
export async function lessonAction(user:string,lesson:string,action:string,body:Record<string,unknown>){
 return sql.begin(async tx=>{
  if(action==='attempt'){
   if(![body.run_id,body.attempt_id,body.exercise_id,body.selected_option_id].every(validUuid))return {status:400,body:{error:'Choose an answer and valid lesson attempt.'}};
   return recordRunAnswer(tx,user,body.run_id as string,body.exercise_id as string,body.selected_option_id as string,body.attempt_id as string,undefined,lesson);
  }
  const hearts=await heartState(tx,user);
  const [access]=await tx`select l.*,e.id as enrollment_id from lessons l join courses c on c.id=l.course_id join enrollments e on e.course_id=c.id where l.id=${lesson} and e.user_id=${user} and l.is_published and c.is_published for share of l,c,e`;
  if(!access)return {status:404,body:{error:'Lesson unavailable.'}};
  if(action==='complete'){
   if(!validUuid(body.run_id))return {status:400,body:{error:'Choose a lesson attempt.'}};
   const run=await runView(tx,body.run_id,user);
   if(!run || run.lesson_id!==lesson)return {status:404,body:{error:'Lesson attempt unavailable.'}};
   return {status:run.completed_at?200:409,body:run.completed_at?{run,hearts}:{error:'Answer every question before completing the attempt.'}};
  }
  if(action!=='start')return {status:400,body:{error:'Unknown lesson action.'}};
  if(!validUuid(body.start_id))return {status:400,body:{error:'Provide a start request ID.'}};
  const [retry]=await tx`select id from lesson_runs where id=${body.start_id}`;
  if(retry){const run=await runView(tx,retry.id,user);if(!run || run.lesson_id!==lesson)return {status:409,body:{error:'Start ID already used.'}};return {status:200,body:{run,hearts}};}
  const [active]=await tx`select id from lesson_runs where enrollment_id=${access.enrollment_id} and lesson_id=${lesson} and completed_at is null`;
  if(active)return {status:hearts.hearts?200:423,body:hearts.hearts?{run:await runView(tx,active.id,user),hearts}:{error:'Restore a heart to resume this attempt.',hearts}};
  if(!hearts.hearts)return {status:423,body:{error:'Restore a heart before starting a graded attempt.',hearts}};
  await tx`insert into lesson_progress(enrollment_id,lesson_id) values(${access.enrollment_id},${lesson}) on conflict do nothing`;
  const [progress]=await tx`select * from lesson_progress where enrollment_id=${access.enrollment_id} and lesson_id=${lesson} for update`;
  const questions=await tx`select id,answer_type,sort_order from exercises where lesson_id=${lesson} order by sort_order`;
  const allocated=allocateXp(questions.map(q=>({id:String(q.id),answer_type:String(q.answer_type)})),access.xp_reward);
  // Legacy perfect completions have already earned their original XP.
  if(progress?.perfected_at)for(const q of allocated)await tx`insert into xp_awards(enrollment_id,lesson_id,exercise_id,source,amount) values(${access.enrollment_id},${lesson},${q.id},'claim',0) on conflict do nothing`;
  const [run]=await tx`insert into lesson_runs(id,enrollment_id,lesson_id,replay) values(${body.start_id},${access.enrollment_id},${lesson},${Boolean(progress?.perfected_at)}) returning *`;
  if(!run)throw new Error('Lesson attempt could not start');
  for(const [index,q] of allocated.entries())await tx`insert into lesson_run_questions(run_id,exercise_id,xp_value,sort_order) values(${run.id},${q.id},${q.value},${index+1})`;
  if(!questions.length)await finishRun(tx,run,user);
  return {status:200,body:{run:await runView(tx,run.id,user),hearts}};
 });
}
export const gamification=Router();
gamification.get('/hearts',async(_req,res)=>res.json(await sql.begin(tx=>heartState(tx,res.locals.user.id))));
async function practiceView(tx:Tx,round:Record<string,any>){
 const [score]=await tx`select count(*)::int as correct_count from practice_submissions where round_id=${round.id} and is_correct`;
 const [question]=round.completed_at?[]:await tx`select x.id,x.prompt,q.question_index,
 l.is_published and c.is_published and exists(
   select 1 from enrollments e join lesson_progress p on p.enrollment_id=e.id
   where e.user_id=${round.user_id} and e.course_id=c.id and p.lesson_id=l.id and p.completed_at is not null
 ) as eligible
 from practice_round_questions q join exercises x on x.id=q.exercise_id
 join lessons l on l.id=x.lesson_id join courses c on c.id=l.course_id
 where q.round_id=${round.id} and not exists(
   select 1 from practice_submissions s where s.round_id=q.round_id and s.question_index=q.question_index and s.is_correct
 ) order by q.question_index limit 1`;
 if(question&&!question.eligible)return {id:round.id,correct_count:score?.correct_count??0,completed_at:round.completed_at,heart_restored:round.heart_restored,question:null};
 const options=question?await tx`select id,option_text from exercise_options where exercise_id=${question.id} order by sort_order`:[];
 return {id:round.id,correct_count:score?.correct_count??0,completed_at:round.completed_at,heart_restored:round.heart_restored,question:question?{id:question.id,prompt:question.prompt,question_index:question.question_index,options}:null};
}
gamification.post('/practice/start',async(_req,res)=>{
 const result=await sql.begin(async tx=>{
  const user=res.locals.user.id,hearts=await heartState(tx,user);
  const [active]=await tx`select * from practice_rounds where user_id=${user} and completed_at is null for update`;
  if(active){const round=await practiceView(tx,active);if(round.question)return {status:200,body:{round,hearts}};await tx`update practice_rounds set completed_at=now() where id=${active.id}`;}
  const seen=await tx`select x.id from enrollments e join lesson_progress p on p.enrollment_id=e.id
  join lessons l on l.id=p.lesson_id and l.course_id=e.course_id join courses c on c.id=l.course_id
  join exercises x on x.lesson_id=l.id
  where e.user_id=${user} and p.completed_at is not null and x.answer_type in ('choice','boolean')
  and l.is_published and c.is_published order by random() limit 3`;
  if(!seen.length)return {status:404,body:{error:'Complete a lesson with multiple-choice or true-or-false exercises to unlock Practice.',hearts}};
  const [round]=await tx`insert into practice_rounds(user_id) values(${user}) returning *`;
  for(let i=0;i<3;i++)await tx`insert into practice_round_questions(round_id,question_index,exercise_id) values(${round!.id},${i},${seen[i%seen.length]!.id})`;
  return {status:200,body:{round:await practiceView(tx,round!),hearts}};
 });res.status(result.status).json(result.body);
});
gamification.post('/practice/answer',async(req,res)=>{
 const {round_id,attempt_id,selected_option_id,question_index}=req.body??{};
 if(![round_id,attempt_id,selected_option_id].every(validUuid) || !Number.isInteger(question_index) || question_index<0 || question_index>2){res.status(400).json({error:'Choose a practice answer.'});return;}
 const result=await sql.begin(async tx=>{
  const user=res.locals.user.id,hearts=await heartState(tx,user);
  const [round]=await tx`select * from practice_rounds where id=${round_id} and user_id=${user} for update`;
  if(!round)return {status:404,body:{error:'Practice round unavailable.'}};
  const [previous]=await tx`select * from practice_submissions where id=${attempt_id}`;
  if(previous)return previous.round_id===round_id && previous.question_index===question_index && previous.selected_option_id===selected_option_id?{status:200,body:{correct:previous.is_correct,round:await practiceView(tx,round),hearts}}:{status:409,body:{error:'Submission ID already used.'}};
  if(round.completed_at)return {status:409,body:{error:'This practice round is finished.'}};
  const view=await practiceView(tx,round);
  if(!view.question)return {status:409,body:{error:'Practice question unavailable. Start a new round.'}};
  if(question_index!==view.question.question_index)return {status:409,body:{error:'This question has changed. Resume your current practice round.'}};
  const [option]=await tx`select id from exercise_options where id=${selected_option_id} and exercise_id=${view.question.id}`;
  if(!option)return {status:400,body:{error:'Choice does not belong to this practice question.'}};
  const [saved]=await tx`insert into practice_submissions(id,round_id,question_index,selected_option_id,is_correct) values(${attempt_id},${round_id},${question_index},${selected_option_id},false) returning is_correct`;
  const next=await practiceView(tx,round);
  if(next.correct_count===3){
   const [reward]=await tx`update learner_hearts set hearts=hearts+1,
     regenerated_at=case when hearts+1=3 then now() else regenerated_at end
     where user_id=${user} and hearts<3 returning hearts`;
   const [completed]=await tx`update practice_rounds set completed_at=now(),heart_restored=${Boolean(reward)}
     where id=${round_id} returning completed_at,heart_restored`;
   next.completed_at=completed!.completed_at;
   next.heart_restored=completed!.heart_restored;
  }
  return {status:200,body:{correct:saved!.is_correct,round:next,hearts:await heartState(tx,user)}};
 });res.status(result.status).json(result.body);
});
