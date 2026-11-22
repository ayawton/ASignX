import express, { Router } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import { connection as sql } from './db/index.js';
import { recognitionRequest, recognitionCapabilities } from './recognitionTransport.js';

import { heartState, recordRunAnswer } from './gamification.js';
export const lessonRecognition=Router();
type Session={run:string;result?:Record<string,any>;user:string;lesson:string;exercise:string;target:string;upstream:string;model:string;touched:number;created:number;busy:boolean;solved:boolean;attempts:number};
const sessions=new Map<string,Session>();
const validId=(v:unknown)=>typeof v==='string' && /^[0-9a-f-]{36}$/i.test(v);
function prune(){for(const [id,s] of sessions)if(Date.now()-s.touched>60000 || Date.now()-s.created>300000){sessions.delete(id);void recognitionRequest(`/sessions/${s.upstream}`,{method:'DELETE'}).catch(()=>{});}}
lessonRecognition.post('/lessons/:id/recognition',async(req,res)=>{
 prune();
 if(!validId(req.params.id) || !validId(req.body?.exercise_id) || !validId(req.body?.run_id)){res.status(400).json({error:'Choose a sign question.'});return;}
 const user=res.locals.user.id;
 if(sessions.size>=64 || [...sessions.values()].filter(s=>s.user===user).length>=2){res.status(429).json({error:'Stop the other lesson cameras before starting another.'});return;}
 const hearts=await sql.begin(tx=>heartState(tx,user));
 if(!hearts.hearts){res.status(423).json({error:'Restore a heart to resume graded practice.',hearts});return;}
 const [access]=await sql`select x.id,s.gloss from lesson_runs r join enrollments e on e.id=r.enrollment_id join lessons l on l.id=r.lesson_id join courses c on c.id=l.course_id join lesson_run_questions q on q.run_id=r.id join exercises x on x.id=q.exercise_id join signs s on s.id=x.sign_id join lesson_signs ls on ls.lesson_id=l.id and ls.sign_id=s.id where r.id=${req.body.run_id} and r.completed_at is null and q.attempt_id is null and q.sort_order=(select min(sort_order) from lesson_run_questions where run_id=r.id and attempt_id is null) and x.id=${req.body.exercise_id} and l.id=${req.params.id as string} and e.user_id=${user} and x.answer_type='recognition' and l.is_published and c.is_published and s.is_published`;
 if(!access){res.status(404).json({error:'Start an available lesson before using this sign question.'});return;}
 try{
  const capabilities=await recognitionCapabilities();
  if(!capabilities.labels.includes(access.gloss)){res.status(409).json({error:'This sign is not supported by the current model. Ask an administrator to update the lesson.'});return;}
  const upstream=await recognitionRequest('/sessions',{method:'POST'});
  if(!/^[A-Za-z0-9_-]{43}$/.test(upstream?.session_id))throw new Error('Invalid session');
  const id=randomBytes(32).toString('base64url');
  sessions.set(id,{run:req.body.run_id,user,lesson:req.params.id as string,exercise:access.id,target:access.gloss,upstream:upstream.session_id,model:capabilities.model,touched:Date.now(),created:Date.now(),busy:false,solved:false,attempts:0});
  res.json({session_id:id});
 }catch{res.status(503).json({error:'Recognition is unavailable. Start the recognition service and retry.'});}
});
lessonRecognition.use('/lesson-recognition/:session',(req,res,next)=>{
 prune();const session=sessions.get(String(req.params.session));
 if(!session || session.user!==res.locals.user.id){res.status(404).json({error:'Camera session expired. Stop and restart the camera.'});return;}
 session.touched=Date.now();res.locals.lessonSession=session;next();
});
lessonRecognition.post('/lesson-recognition/:session/frames',express.raw({type:'image/jpeg',limit:'256kb'}),async(req,res)=>{
 const session=res.locals.lessonSession as Session;
 if(!req.is('image/jpeg') || !Buffer.isBuffer(req.body) || !req.body.length){res.status(415).json({error:'Send a JPEG camera frame.'});return;}
 if(session.busy){res.status(429).json({error:'Wait for the previous frame.'});return;}
 if(session.solved){res.json(session.result??{correct:true});return;}
 if(session.attempts>=50){res.status(409).json({error:'Stop and restart the camera to try again.'});return;}
 session.busy=true;
 try{
  const data=await recognitionRequest(`/sessions/${session.upstream}/frames`,{method:'POST',headers:{'Content-Type':'image/jpeg','X-Frame-Timestamp':req.get('X-Frame-Timestamp') ?? ''},body:new Uint8Array(req.body)});
  const emissions=Array.isArray(data?.emissions)?data.emissions:[];
  const valid=emissions.filter((e:{label?:unknown;confidence?:unknown})=>typeof e.label==='string' && typeof e.confidence==='number' && Number.isFinite(e.confidence) && e.confidence>=.8 && e.confidence<=1);
  const emission=valid.find((e:{label:string})=>e.label===session.target) ?? valid[0];
  if(!emission){res.json({correct:false,waiting:true});return;}
  const saved=await sql.begin(async tx=>{
   await heartState(tx,session.user);
   const [access]=await tx`select e.id as enrollment_id,s.gloss from exercises x join lessons l on l.id=x.lesson_id join courses c on c.id=l.course_id join enrollments e on e.course_id=c.id join signs s on s.id=x.sign_id join lesson_signs ls on ls.lesson_id=l.id and ls.sign_id=s.id where x.id=${session.exercise} and l.id=${session.lesson} and e.user_id=${session.user} and x.answer_type='recognition' and l.is_published and c.is_published and s.is_published for share of l,c,e,x,s`;
   if(!access || access.gloss!==session.target)return {status:409,body:{error:'Sign question unavailable.'}};
   return recordRunAnswer(tx,session.user,session.run,session.exercise,null,randomUUID(),{label:emission.label,confidence:emission.confidence.toFixed(5),model:session.model});
  });
  if(saved.status!==200){res.status(saved.status).json(saved.body);return;}
  session.attempts++;session.solved=Boolean('correct' in saved.body && saved.body.correct);
  session.result={...saved.body,label:emission.label,confidence:emission.confidence};
  res.json(session.result);

 }catch{res.status(503).json({error:'Recognition could not be saved. Stop and restart the camera to retry.'});}
 finally{session.busy=false;}
});
lessonRecognition.delete('/lesson-recognition/:session',async(req,res)=>{
 const session=res.locals.lessonSession as Session;sessions.delete(String(req.params.session));
 await recognitionRequest(`/sessions/${session.upstream}`,{method:'DELETE'}).catch(()=>{});res.status(204).end();
});
