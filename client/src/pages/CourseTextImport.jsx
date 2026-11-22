import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FileText, Download, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { api } from '../auth'
import { courseTemplate, lessonsTemplate } from '../data/courseTemplate'
import './Admin.css'
const types = { choice:'Single choice', boolean:'True / false', recognition:'Sign with camera' }
export default function CourseTextImport(){
 const { id }=useParams()
 return <TextImport key={id||'new'} id={id}/>
}
function TextImport({id}){
 const navigate=useNavigate(),previewHeading=useRef(null),errorPanel=useRef(null),mounted=useRef(true),requestId=useRef(null)
 const [text,setText]=useState(''),[preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[course,setCourse]=useState(null),[loadError,setLoadError]=useState('')
 const template=id?lessonsTemplate:courseTemplate,back=id?`/dashboard/admin/courses/${id}`:'/dashboard/admin/courses'
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{if(!id)return;let active=true;api(`/admin/courses/${id}`).then(value=>{if(active)setCourse(value)}).catch(e=>{if(active)setLoadError(e.message)});return()=>{active=false}},[id])
 useEffect(()=>{if(error)errorPanel.current?.focus()},[error])
 const unavailable=Boolean(id&&(!course||course.is_published||course.is_archived))
 function change(value){setText(value);setPreview(null);setError('');requestId.current=null}
 async function upload(event){
  const file=event.target.files?.[0];event.target.value='';if(!file)return
  setPreview(null);setError('')
  if(!file.name.toLowerCase().endsWith('.txt')||file.size>100000){setError('Choose a .txt file up to 100 KB.');return}
  setBusy(true)
  try{const value=await file.text();if(mounted.current)change(value)}catch{if(mounted.current)setError('The file could not be read. Paste the text instead.')}finally{if(mounted.current)setBusy(false)}
 }
 async function inspect(event){
  event.preventDefault();if(busy||unavailable)return;if(new TextEncoder().encode(text).length>100000){setPreview(null);setError('Text must be at most 100 KB.');return}setBusy(true);setError('');setPreview(null)
  try{const value=await api(id?`/admin/courses/${id}/import/preview`:'/admin/courses/import/preview',{method:'POST',body:JSON.stringify({text})});if(mounted.current){setPreview(value);setTimeout(()=>previewHeading.current?.focus(),0)}}catch(e){if(mounted.current)setError(e.message)}finally{if(mounted.current)setBusy(false)}
 }
 async function save(){
  if(busy||!preview||unavailable)return;setBusy(true);setError('');requestId.current??=crypto.randomUUID()
  try{const result=await api(id?`/admin/courses/${id}/import`:'/admin/courses/import',{method:'POST',body:JSON.stringify({text,import_id:requestId.current})});if(mounted.current)navigate(`/dashboard/admin/courses/${result.id}`)}catch(e){if(mounted.current)setError(e.message)}finally{if(mounted.current)setBusy(false)}
 }
 const questions=preview?.lessons.reduce((total,l)=>total+l.exercises.length,0)||0
 return <section className="admin-authoring studio-section studio-page course-text-import">
  <Link className="text-link" to={back}><ArrowLeft size={16}/> Back to {id?'course':'courses'}</Link>
  <header className="page-heading"><div><h1>{id?'Add lessons from text':'Create a course from text'}</h1><p>{id?`Append lessons to ${course?.title||'your draft course'}. Existing lessons stay in place.`:'Turn a structured outline into a draft course, complete with lessons and exercises.'} Preview the result before saving.</p></div></header>
  {loadError?<p role="alert">{loadError}</p>:id&&!course?<p role="status">Loading course…</p>:unavailable?<p role="alert">This course is published or archived. Create a draft copy before importing lessons.</p>:<>
  <div className="course-import-grid">
   <form className="studio-progress-panel admin-form import-source" onSubmit={inspect} aria-busy={busy}>
    <h2><FileText size={21}/> Course structure</h2>
    <p>Start with the template, then replace its sample content with your reviewed material.</p>
    <div className="import-tools"><a className="text-link" download={id?'asignx-lessons-template.txt':'asignx-course-template.txt'} href={`data:text/plain;charset=utf-8,${encodeURIComponent(template)}`}><Download size={16}/> Download template</a><button type="button" className="text-link" disabled={busy} onClick={()=>{if(!text.trim()||window.confirm('Replace the current text with the example template?'))change(template)}}>Use example</button></div>
    <label>Upload a text file<input type="file" accept=".txt,text/plain" onChange={upload} disabled={busy}/></label>
    <label htmlFor="course-import-text">Or paste your structure<textarea id="course-import-text" className="import-textarea" rows={22} spellCheck={false} value={text} onChange={e=>change(e.target.value)} disabled={busy} aria-describedby="import-format-help" placeholder={id?'Lesson: Your lesson title':'Course: Your course title'}/></label>
    <p id="import-format-help" className="import-help">Up to 100 KB and 25 lessons per import. Questions support choice, boolean and recognition. Use * for a correct choice and - for other choices. Indent multiline content with two spaces.</p>
    <details><summary>Sign labels and camera questions</summary><p>Signs: A, B links existing published signs. Target: A adds a camera target and links it automatically. Labels must match the sign library; the running recognition service must support camera targets. This importer creates lesson structure, not new signs or videos.</p></details>
    <div className="admin-actions"><button className="btn" disabled={busy||!text.trim()}>{busy?'Working…':'Preview structure'}</button></div>
   </form>
   <section className="studio-progress-panel import-preview" aria-label="Import preview">
    <h2 ref={previewHeading} tabIndex={-1}>Preview</h2>
    {preview?<><h3>{preview.title}</h3>{preview.description&&<p className="import-description">{preview.description}</p>}<p className="import-summary">{preview.lessons.length} lessons · {questions} questions · {preview.lessons.reduce((n,l)=>n+l.xp_reward,0)} total XP</p>
     <ol className="import-outline">{preview.lessons.map((lesson,i)=><li key={i}><div className="import-lesson-heading"><h3>{lesson.sort_order}. {lesson.title}</h3><span>{lesson.xp_reward} XP</span></div><p className="import-material">{lesson.content}</p>{lesson.sign_labels.length>0&&<p>Linked signs: {lesson.sign_labels.join(', ')}</p>}{!lesson.exercises.length?<p>No exercises; material-only lesson.</p>:lesson.exercises.map((q,j)=><div className="import-question" key={j}><span>{types[q.answer_type]}</span><h4>{q.prompt}</h4>{q.answer_type==='recognition'?<p>Target: {q.target}</p>:<ul>{q.options.map((o,k)=><li key={k} className={o.is_correct?'import-correct':''}>{o.option_text}{o.is_correct&&<><CheckCircle2 size={15} aria-hidden="true"/><span className="sr-only"> (correct answer)</span></>}</li>)}</ul>}</div>)}</li>)}</ol>
     <p className="admin-notice">Everything is saved as a draft. Review the content and graphic in the course editor before publishing.</p><div className="admin-actions"><button className="btn" type="button" onClick={save} disabled={busy}>{busy?'Saving…':id?'Add lessons to draft':'Create draft course'}</button><Link className="text-link" to={back}>Cancel</Link></div>
    </>:<div className="import-preview-empty"><FileText size={36} aria-hidden="true"/><h3>Your lesson outline will appear here</h3><p>Preview checks the structure, choices and sign labels without creating any records.</p></div>}
   </section>
  </div>
  {error&&<div ref={errorPanel} tabIndex={-1} className="admin-notice import-error" role="alert"><p>{error}</p><p>Correct the text and preview again. If a save response was interrupted, <Link className="text-link" to={back}>check {id?'the course':'your course list'}</Link> before starting a new import.</p></div>}
  </>}
 </section>
}
