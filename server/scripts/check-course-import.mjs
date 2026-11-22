import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import {connection as sql} from '../dist/db/index.js';
const rollback=new Error('ROLLBACK_IMPORT_FIXTURES');let verified=false;
try{
 const bundle=await build({entryPoints:['src/courseImportRoutes.ts'],bundle:true,write:false,platform:'node',format:'esm',packages:'external',plugins:[{name:'rollback-import',setup(b){b.onResolve({filter:/^\.\/db\/index\.js$/},()=>({path:'db',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const connection=Object.assign((...args)=>globalThis.__importTx(...args),{begin:fn=>fn(globalThis.__importTx)})'}))}}]});
 const source=bundle.outputFiles[0].text.replaceAll('from "express"',`from ${JSON.stringify(import.meta.resolve('express'))}`);
 const {courseImportRoutes:routes}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
 try{await sql.begin(async tx=>{
 globalThis.__importTx=tx;
 const text='Course: Rollback-only import\nLesson: First\nContent: Reviewed material\nQuestion: choice | Pick A\n* A\n- B\nQuestion: boolean | True?\nAnswer: true';
 const call=async(path,body,course)=>{const res={code:200,status(code){this.code=code;return this},json(body){this.body=body}};await routes.stack.find(l=>l.route?.path===path).route.stack[0].handle({params:course?{id:course}:{},body},res);return res};
 const request=randomUUID();assert.equal((await call('/courses/import/preview',{text})).code,200);
 assert.equal((await call('/courses/import',{text,import_id:request})).code,201);
 assert.equal((await call('/courses/import',{text,import_id:request})).code,409);
 assert.equal((await call('/courses/:id/import',{text:'Lesson: Second\nContent: More material',import_id:randomUUID()},request)).code,201);
 const [counts]=await tx`select (select count(*)::int from lessons where course_id=${request}) as lessons,(select count(*)::int from exercises x join lessons l on l.id=x.lesson_id where l.course_id=${request}) as questions,(select count(*)::int from exercise_options o join exercises x on x.id=o.exercise_id join lessons l on l.id=x.lesson_id where l.course_id=${request}) as options`;
 assert.deepEqual({...counts},{lessons:2,questions:2,options:4});await tx`update lessons set is_published=true where course_id=${request}`;
 verified=true;throw rollback;
 });}catch(e){if(e!==rollback)throw e}
 assert.ok(verified);console.log('PASS live driver: preview, batched imports, duplicate protection and publication validation; fixtures rolled back.');
}catch(e){console.error(JSON.stringify({checkFailed:true,code:e.code,message:e.message}));process.exitCode=1}finally{delete globalThis.__importTx;await sql.end()}
