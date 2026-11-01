import express, { Router } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import { connection as sql } from './db/index.js';
import { recognitionRequest, recognitionCapabilities } from './recognitionTransport.js';

export const lessonRecognition=Router();
type Session={user:string;lesson:string;exercise:string;target:string;upstream:string;model:string;touched:number;created:number;busy:boolean;solved:boolean;attempts:number};
const sessions=new Map<string,Session>();
const validId=(v:unknown)=>typeof v==='string' && /^[0-9a-f-]{36}$/i.test(v);
function prune(){for(const [id,s] of sessions)if(Date.now()-s.touched>60000 || Date.now()-s.created>300000){sessions.delete(id);void recognitionRequest(`/sessions/${s.upstream}`,{method:'DELETE'}).catch(()=>{});}}
lessonRecognition.post('/lessons/:id/recognition',async(req,res)=>{
 prune();
 if(!validId(req.params.id) || !validId(req.body?.exercise_id)){res.status(400).json({error:'Choose a sign question.'});return;}
 const user=res.locals.user.id;
 if(sessions.size>=64 || [...sessions.values()].filter(s=>s.user===user).length>=2){res.status(429).json({error:'Stop the other lesson cameras before starting another.'});return;}
 const [access]=await sql`select x.id,s.gloss from exercises x join lessons l on l.id=x.lesson_id join courses c on c.id=l.course_id join enrollments e on e.course_id=c.id join lesson_progress lp on lp.lesson_id=l.id and lp.enrollment_id=e.id join signs s on s.id=x.sign_id join lesson_signs ls on ls.lesson_id=l.id and ls.sign_id=s.id where x.id=${req.body.exercise_id} and l.id=${req.params.id as string} and e.user_id=${user} and x.answer_type='recognition' and l.is_published and c.is_published and s.is_published and lp.completed_at is null`;
 if(!access){res.status(404).json({error:'Start an available lesson before using this sign question.'});return;}
 try{
  const capabilities=await recognitionCapabilities();
  if(!capabilities.labels.includes(access.gloss)){res.status(409).json({error:'This sign is not supported by the current model. Ask an administrator to update the lesson.'});return;}
  const upstream=await recognitionRequest('/sessions',{method:'POST'});
  if(!/^[A-Za-z0-9_-]{43}$/.test(upstream?.session_id))throw new Error('Invalid session');
  const id=randomBytes(32).toString('base64url');
  sessions.set(id,{user,lesson:req.params.id as string,exercise:access.id,target:access.gloss,upstream:upstream.session_id,model:capabilities.model,touched:Date.now(),created:Date.now(),busy:false,solved:false,attempts:0});
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
 if(session.solved){res.json({correct:true});return;}
 if(session.attempts>=50){res.status(429).json({error:'Stop and restart the camera to try again.'});return;}
 session.busy=true;
 try{
  const data=await recognitionRequest(`/sessions/${session.upstream}/frames`,{method:'POST',headers:{'Content-Type':'image/jpeg','X-Frame-Timestamp':req.get('X-Frame-Timestamp') ?? ''},body:new Uint8Array(req.body)});
  const emissions=Array.isArray(data?.emissions)?data.emissions:[];
  const emission=emissions.find((e:{label?:unknown;confidence?:unknown})=>typeof e.label==='string' && typeof e.confidence==='number' && Number.isFinite(e.confidence) && e.confidence>=.8 && e.confidence<=1);
  if(!emission){res.json({correct:false,waiting:true});return;}
  const saved=await sql.begin(async tx=>{
   const [access]=await tx`select e.id as enrollment_id, s.gloss from exercises x join lessons l on l.id=x.lesson_id join courses c on c.id=l.course_id join enrollments e on e.course_id=c.id join signs s on s.id=x.sign_id join lesson_signs ls on ls.lesson_id=l.id and ls.sign_id=s.id where x.id=${session.exercise} and l.id=${session.lesson} and e.user_id=${session.user} and x.answer_type='recognition' and l.is_published and c.is_published and s.is_published for share of l,c,e,x,s`;
   if(!access || access.gloss!==session.target)return null;
   const [progress]=await tx`select completed_at from lesson_progress where enrollment_id=${access.enrollment_id} and lesson_id=${session.lesson} for update`;
   if(!progress || progress.completed_at)return null;
   const correct=emission.label===session.target;
   const [option]=await tx`select id from exercise_options where exercise_id=${session.exercise} and is_correct=${correct} order by sort_order limit 1`;
   if(!option)return null;
   const [attempt]=await tx`insert into exercise_attempts(id,enrollment_id,exercise_id,selected_option_id,response_text,recognition_confidence,recognition_model,is_correct) values(${randomUUID()},${access.enrollment_id},${session.exercise},${option.id},${emission.label},${emission.confidence.toFixed(5)},${session.model},false) returning is_correct`;
   return attempt;
  });
  if(!saved){res.status(409).json({error:'This sign question is no longer available.'});return;}
  session.attempts++;session.solved=Boolean(saved.is_correct);
  res.json({correct:saved.is_correct,label:emission.label,confidence:emission.confidence});
 }catch{res.status(503).json({error:'Recognition could not be saved. Stop and restart the camera to retry.'});}
 finally{session.busy=false;}
});
lessonRecognition.delete('/lesson-recognition/:session',async(req,res)=>{
 const session=res.locals.lessonSession as Session;sessions.delete(String(req.params.session));
 await recognitionRequest(`/sessions/${session.upstream}`,{method:'DELETE'}).catch(()=>{});res.status(204).end();
});
