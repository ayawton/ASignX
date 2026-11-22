import { randomUUID } from 'node:crypto';
import type { TransactionSql } from 'postgres';
const validId=(value:unknown)=>typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export type Question = { answer_type?: string; sign_id?: string; prompt: string; options: { option_text: string; is_correct: boolean }[] };
export function lessonValues(body: Record<string, unknown>) {
 const { title, content, sort_order, xp_reward, exercises } = body;
 if (typeof title!=='string' || !title.trim() || title.trim().length>150 || typeof content!=='string' || content.length>6000 || !Number.isInteger(sort_order) || Number(sort_order)<1 || Number(sort_order)>2147483647 || !Number.isInteger(xp_reward) || Number(xp_reward)<0 || Number(xp_reward)>2147483647 || !Array.isArray(exercises) || exercises.length>10) return null;
 for (const q of exercises) {
  if(!q || !['choice','boolean','recognition'].includes(q.answer_type ?? 'choice')) return null;
  if(q.answer_type==='recognition' && !validId(q.sign_id)) return null;
  if(q.answer_type==='boolean' && (!Array.isArray(q.options) || q.options.length!==2 || q.options[0]?.option_text!=='True' || q.options[1]?.option_text!=='False')) return null;
  if (!q || typeof q.prompt!=='string' || !q.prompt.trim() || q.prompt.length>1000 || !Array.isArray(q.options) || (q.answer_type==='recognition' ? q.options.length!==0 : q.options.length<2 || q.options.length>6) || q.options.some((o: Question['options'][number]) => !o || typeof o.option_text!=='string' || !o.option_text.trim() || o.option_text.length>500 || typeof o.is_correct!=='boolean') || (q.answer_type!=='recognition' && q.options.filter((o: Question['options'][number]) => o.is_correct).length!==1)) return null;
 }
 return { title: title.trim(), content, sort_order: Number(sort_order), xp_reward: Number(xp_reward), exercises: exercises as Question[] };
}

export async function writeLessonContent(tx:TransactionSql<{}>,lesson:string,questions:Question[],signIds:string[]){
 return writeLessonContents(tx,[{id:lesson,exercises:questions,sign_ids:signIds}]);
}
/** Batch child rows so large text imports do not pay one remote round trip per option. */
export async function writeLessonContents(tx:TransactionSql<{}>,lessons:{id:string;exercises:Question[];sign_ids:string[]}[]){
 const links=lessons.flatMap(l=>l.sign_ids.map((id,i)=>({lesson_id:l.id,sign_id:id,sort_order:i+1})));
 const questions=lessons.flatMap(l=>l.exercises.map((q,i)=>({id:randomUUID(),lesson_id:l.id,prompt:q.prompt.trim(),sort_order:i+1,answer_type:q.answer_type??'choice',sign_id:q.answer_type==='recognition'?q.sign_id!:null,options:q.options})));
 const options=questions.flatMap(q=>q.options.map((o,i)=>({exercise_id:q.id,option_text:o.option_text.trim(),is_correct:o.is_correct,sort_order:i+1})));
 // Explicit text->JSONB avoids the configured driver's JSON parameter serializer.
 if(links.length)await tx`insert into lesson_signs(lesson_id,sign_id,sort_order) select lesson_id,sign_id,sort_order from jsonb_to_recordset(${JSON.stringify(links)}::text::jsonb) as r(lesson_id uuid,sign_id uuid,sort_order int)`;
 if(questions.length)await tx`insert into exercises(id,lesson_id,prompt,sort_order,answer_type,sign_id) select id,lesson_id,prompt,sort_order,answer_type,sign_id from jsonb_to_recordset(${JSON.stringify(questions)}::text::jsonb) as r(id uuid,lesson_id uuid,prompt text,sort_order int,answer_type text,sign_id uuid)`;
 if(options.length)await tx`insert into exercise_options(exercise_id,option_text,is_correct,sort_order) select exercise_id,option_text,is_correct,sort_order from jsonb_to_recordset(${JSON.stringify(options)}::text::jsonb) as r(exercise_id uuid,option_text text,is_correct boolean,sort_order int)`;
}
