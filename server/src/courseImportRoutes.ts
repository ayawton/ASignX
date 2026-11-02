import { Router } from 'express';
import type { Request,Response } from 'express';
import { createHash } from 'node:crypto';
import { connection as sql } from './db/index.js';
import { parseCourseText,ImportError } from './courseImport.js';
import { lessonValues,writeLessonContents } from './courseAuthoring.js';
import { recognitionCapabilities } from './recognitionTransport.js';
import { validUuid } from './gamification.js';
export const courseImportRoutes=Router();
class ImportConflict extends Error {constructor(message:string,readonly courseId:string){super(message)}}
function lessonId(request:string,index:number){const chars=createHash('sha256').update(`${request}:${index}`).digest('hex').slice(0,32).split('');chars[12]='4';chars[16]='8';const hex=chars.join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`}
async function handleImport(req:Request,res:Response,save:boolean){
 const courseId=req.params.id as string|undefined;
 if(courseId&&!validUuid(courseId)){res.status(400).json({error:'Choose a valid draft course.'});return}
 const requestId=req.body?.import_id;
 if(save&&!validUuid(requestId)){res.status(400).json({error:'Provide an import request ID.'});return}
 try{
  const plan=parseCourseText(req.body?.text,courseId?'lessons':'course');
  const needsRecognition=plan.lessons.some(l=>l.exercises.some(q=>q.answer_type==='recognition'));
  let supported:string[]=[];
  if(needsRecognition){try{supported=(await recognitionCapabilities()).labels}catch{res.status(503).json({error:'Start the recognition service before previewing or importing camera questions.'});return}}
  const result=await sql.begin(async tx=>{
   let title=plan.title,description=plan.description,offset=0;
   if(courseId){
    const [course]=await tx`select id,title,description from courses c where id=${courseId} and not is_published and not exists(select 1 from lessons where course_id=c.id and is_published) for update`;
    if(!course)throw new ImportConflict('Only draft courses can receive imported lessons. Create a draft copy of a published or archived course first.',courseId);
    title=course.title;description=course.description??'';
    const [last]=await tx`select coalesce(max(sort_order),0)::int as position from lessons where course_id=${courseId}`;offset=last!.position;
   }
   if(offset+plan.lessons.length>2147483647)throw new ImportError('No lesson positions remain in this course.',1);
   const labels=[...new Set(plan.lessons.flatMap(l=>[...l.signs,...l.exercises.flatMap(q=>q.target?[q.target]:[])]).map(s=>s.toLowerCase()))];
   const signs=labels.length?await tx`select id,gloss from signs where is_published and lower(gloss)=any(${labels}::text[]) for share`:[];
   const resolve=(label:string,line:number)=>{
    const matches=signs.filter(s=>s.gloss.toLowerCase()===label.toLowerCase());const exact=matches.find(s=>s.gloss===label);
    if(exact)return exact;if(matches.length===1)return matches[0]!;
    throw new ImportError(matches.length?`Sign “${label}” is ambiguous. Use its exact library label.`:`Published sign “${label}” was not found. Add it to the sign library first.`,line);
   };
   const lessons=plan.lessons.map((l,index)=>{
    const linked=[...new Map([...l.signs,...l.exercises.flatMap(q=>q.target?[q.target]:[])].map(label=>{const s=resolve(label,l.line);return [s.id,s]})).values()];
    if(linked.length>50)throw new ImportError('Each lesson supports up to 50 distinct linked signs.',l.line);
    const exercises=l.exercises.map(q=>{
     const target=q.target?resolve(q.target,q.line):null;
     if(target&&!supported.includes(target.gloss))throw new ImportError(`The running recognition model does not support “${target.gloss}”.`,q.line);
     return {...q,sign_id:target?.id};
    });
    const values=lessonValues({...l,sort_order:offset+index+1,exercises});if(!values)throw new ImportError('Lesson does not meet the authoring limits.',l.line);
    return {...values,sign_ids:linked.map(s=>String(s.id)),sign_labels:linked.map(s=>String(s.gloss))};
   });
   if(!save)return {title,description,lessons};
   const targetId=courseId??requestId;
   const [already]=courseId?await tx`select id from lessons where id=${lessonId(requestId,0)}`:await tx`select id from courses where id=${requestId}`;
   if(already)throw new ImportConflict('This import request already created a draft. Open the course to check its content.',targetId);
   if(!courseId)await tx`insert into courses(id,title,description,is_published) values(${targetId},${title},${description},false)`;
   const rows=lessons.map((l,i)=>({...l,id:lessonId(requestId,i),course_id:targetId}));
   await tx`insert into lessons(id,course_id,title,content,sort_order,xp_reward,is_published) select id,course_id,title,content,sort_order,xp_reward,false from jsonb_to_recordset(${JSON.stringify(rows)}::text::jsonb) as r(id uuid,course_id uuid,title text,content text,sort_order int,xp_reward int)`;
   await writeLessonContents(tx,rows);
   return {id:targetId,lesson_count:lessons.length};
  });
  res.status(save?201:200).json(result);
 }catch(error){
  if(error instanceof ImportError){res.status(400).json({error:error.message,line:error.line});return}
  if(error instanceof ImportConflict){res.status(409).json({error:error.message,course_id:error.courseId});return}
  if((error as {code?:string}).code==='23505'){res.status(409).json({error:'This import was already saved or another edit changed the course. Open the course to check before retrying.'});return}
  throw error;
 }
}
courseImportRoutes.post('/courses/import/preview',(req,res)=>handleImport(req,res,false));
courseImportRoutes.post('/courses/import',(req,res)=>handleImport(req,res,true));
courseImportRoutes.post('/courses/:id/import/preview',(req,res)=>handleImport(req,res,false));
courseImportRoutes.post('/courses/:id/import',(req,res)=>handleImport(req,res,true));
