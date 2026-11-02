import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BookOpen, Plus, CheckCircle2 } from 'lucide-react'
import { api, useAuth } from '../auth'
import './Admin.css'
import CourseLifecycle from '../components/CourseLifecycle'

export default function AdminCourse() {
 const { id } = useParams(), { user } = useAuth()
 return <CourseEditor key={`${user?.id}:${id}`} id={id} />
}
const blankQuestion = () => ({ answer_type:'choice', prompt: '', options: [{ option_text: '', is_correct: true }, { option_text: '', is_correct: false }] })
function CourseEditor({ id }) {
 const [course, setCourse] = useState(null), [error, setError] = useState(''), [message, setMessage] = useState('')
 const [draft, setDraft] = useState(null), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0), [confirmPublish, setConfirmPublish] = useState(false)
 const [signs,setSigns] = useState([])
 const [recognition,setRecognition] = useState(null),[recognitionError,setRecognitionError]=useState('')
 useEffect(()=>{let active=true;api('/admin/recognition-signs').then(value=>{if(active)setRecognition(value)}).catch(()=>{if(active)setRecognitionError('Recognition service unavailable. Start it to author camera questions.')});return()=>{active=false}},[])
 const frozen=Boolean(course?.is_published || course?.is_archived)
 useEffect(() => {
  let active = true
  Promise.all([api(`/admin/courses/${id}`),api('/admin/signs')]).then(([value,library]) => { if (active) { setCourse(value); setSigns(library); setError('') } }).catch(e => { if (active) setError(e.message) })
  return () => { active = false }
 }, [id, revision])
 function open(lesson) {
  setMessage(''); setConfirmPublish(false)
  setDraft(lesson ? { ...lesson, sign_ids:lesson.sign_ids || [], lesson_id: lesson.id, exercises: lesson.exercises.map(q => ({ ...q, options: q.options.map(o => ({ ...o })) })) } : { title: '', content: '', sort_order: Math.max(0, ...course.lessons.map(l => l.sort_order)) + 1, xp_reward: 10, exercises: [],sign_ids:[] })
 }
 function field(name,value) { setDraft(previous => ({ ...previous, [name]: value })) }
 function question(index,change) { setDraft(previous => ({ ...previous, exercises: previous.exercises.map((q,i) => i===index ? { ...q, ...change } : q) })) }
 async function save(event) {
  event.preventDefault(); if (busy) return
  setBusy(true); setMessage('')
  try { await api(`/admin/courses/${id}/lessons`, { method: 'POST', body: JSON.stringify(draft) }); setDraft(null); setRevision(v => v+1); setMessage('Lesson saved to this draft course.') }
  catch(e) { setMessage(e.message) } finally { setBusy(false) }
 }
 async function publish() {
  if (busy) return
  setBusy(true); setMessage('')
  try { await api(`/admin/courses/${id}/publish`, { method: 'POST', body: '{}' }); setCourse(null); setConfirmPublish(false); setRevision(v => v+1); setMessage('Course published. Learners can now enroll.') }
  catch(e) { setMessage(e.message) } finally { setBusy(false) }
 }
 return <section className="admin-authoring studio-section studio-page"><Link className="text-link" to="/dashboard/admin/courses">Back to courses</Link>
  {error ? <div role="alert"><h1>Course unavailable</h1><p>{error}</p><button className="btn" onClick={() => setRevision(v => v+1)}>Try again</button></div> : !course ? <><h1>Course editor</h1><p role="status">Loading course…</p></> : <>
   <header className="page-heading"><div><span className="admin-status">{course.is_published ? 'Published' : course.is_archived ? 'Archived' : 'Draft course'}</span><h1>{course.title}</h1><p>{course.description}</p></div></header>
   <Link className="text-link" to={`/dashboard/admin/courses/${id}/edit`}>Edit details and graphic</Link>
   {!frozen && !draft && <Link className="text-link" to={`/dashboard/admin/courses/${id}/import`}>Import lessons from text</Link>}
   <CourseLifecycle course={course} disabled={busy || Boolean(draft)} onChanged={()=>{setCourse(null);setRevision(v=>v+1)}} />
   {course.is_archived&&<p className="admin-notice">Archived: hidden from learners, with existing learning records preserved. Create a draft copy to revise the content, or publish again to restore access.</p>}
   {message && <p className="admin-notice" role="status">{message}</p>}
   <div className="admin-authoring-grid"><aside className="studio-progress-panel admin-outline"><h2><BookOpen size={21} /> Course outline</h2><p>{course.lessons.length} lessons in course order</p>
    <ol>{course.lessons.map(lesson => <li key={lesson.id}><button type="button" disabled={busy} aria-current={draft?.lesson_id===lesson.id ? 'true' : undefined} onClick={() => open(lesson)}><strong>{lesson.title}</strong><span>Position {lesson.sort_order} · {lesson.xp_reward} XP{lesson.locked ? ' · Read only' : ''}</span></button></li>)}</ol>
    {!course.lessons.length && <p>Add your first lesson to begin building this course.</p>}
    {!frozen && <button className="btn btn-secondary" disabled={busy} onClick={() => open(null)}><Plus size={17} /> Add lesson</button>}
   </aside><div>
    {draft ? <form className="studio-progress-panel admin-form" onSubmit={save}><h2>{draft.lesson_id ? 'Lesson details' : 'New lesson'}</h2>
     {(draft.locked || frozen) && <p className="admin-notice">Published or used lessons are read only. Create a new draft for changes.</p>}
     <fieldset disabled={busy || draft.locked || frozen}>
      <label>Lesson title<input required maxLength={150} value={draft.title} onChange={e => field('title',e.target.value)} /></label>
      <div className="admin-field-pair"><label>Lesson order<input type="number" required min={1} max={2147483647} value={draft.sort_order} onChange={e => field('sort_order',Number(e.target.value))} /></label><label>XP reward<input type="number" required min={0} max={2147483647} value={draft.xp_reward} onChange={e => field('xp_reward',Number(e.target.value))} /></label></div>
      <label>Written lesson material<textarea rows={8} maxLength={6000} value={draft.content || ''} onChange={e => field('content',e.target.value)} /></label><small>Use plain text. Written material is required before publishing.</small>
      <h3>Lesson signs</h3><p>Select published signs in the order learners should see them. <Link className="text-link" to="/dashboard/admin/signs">Open sign library</Link></p>
      {!signs.some(s=>s.is_published)&&<p>No published signs yet. Save this lesson, then publish signs in the library.</p>}
      {signs.filter(s=>s.is_published || draft.sign_ids.includes(s.id)).map(sign=><label key={sign.id} className="admin-publish-check"><input type="checkbox" checked={draft.sign_ids.includes(sign.id)} disabled={!sign.is_published} onChange={e=>field('sign_ids',e.target.checked?[...draft.sign_ids,sign.id]:draft.sign_ids.filter(id=>id!==sign.id))} />{sign.gloss} — {sign.meaning}</label>)}
      {draft.sign_ids.length>0&&<ol>{draft.sign_ids.map((signId,index)=><li key={signId}>{signs.find(s=>s.id===signId)?.gloss || 'Unavailable sign'} <button className="text-link" type="button" disabled={index===0} onClick={()=>{const ordered=[...draft.sign_ids];[ordered[index-1],ordered[index]]=[ordered[index],ordered[index-1]];field('sign_ids',ordered)}}>Move earlier</button></li>)}</ol>}
      <h3>Knowledge check</h3><p>Questions are optional. Choose a response type for each question. Saved model predictions are required for camera questions.</p>
      {draft.exercises.map((q,index) => <fieldset className="admin-question" key={q.id || index}><legend>Question {index+1}</legend><label>Answer type<select value={q.answer_type||'choice'} onChange={e=>{const type=e.target.value;question(index,{answer_type:type,sign_id:null,options:type==='boolean'?[{option_text:'True',is_correct:true},{option_text:'False',is_correct:false}]:type==='recognition'?[]:blankQuestion().options})}}><option value="choice">Single choice</option><option value="boolean">True / false</option><option value="recognition">Sign with camera</option></select></label><label>Question text<textarea required maxLength={1000} rows={2} value={q.prompt} onChange={e => question(index,{prompt:e.target.value})} /></label>
       {q.answer_type==='recognition' && <><label>Target sign<select required value={q.sign_id||''} onChange={e=>question(index,{sign_id:e.target.value})}><option value="">Choose a supported lesson sign</option>{signs.filter(sign=>draft.sign_ids.includes(sign.id) && sign.is_published && recognition?.labels.includes(sign.gloss)).map(sign=><option key={sign.id} value={sign.id}>{sign.gloss}</option>)}</select></label><p>{recognitionError||'Targets must be published signs linked to this lesson and supported by the running model.'}</p></>}
       {q.answer_type!=='recognition' && q.options.map((option,choice) => <div className="admin-option" key={option.id || choice}><label className="admin-correct"><input type="radio" name={`correct-${index}`} checked={option.is_correct} onChange={() => question(index,{options:q.options.map((o,i) => ({...o,is_correct:i===choice}))})} /><span>Correct answer {choice+1}</span></label><label>Choice {choice+1}<input required maxLength={500} value={option.option_text} readOnly={q.answer_type==='boolean'} onChange={e => question(index,{options:q.options.map((o,i) => i===choice ? {...o,option_text:e.target.value} : o)})} /></label>{q.options.length>2 && <button className="text-link" type="button" onClick={() => { const options=q.options.filter((_,i) => i!==choice); if (!options.some(o => o.is_correct)) options[0]={...options[0],is_correct:true}; question(index,{options}) }}>Remove choice {choice+1}</button>}</div>)}
       <div className="admin-actions">{(!q.answer_type || q.answer_type==='choice') && q.options.length<6 && <button className="text-link" type="button" onClick={() => question(index,{options:[...q.options,{option_text:'',is_correct:false}]})}>Add answer choice</button>}<button className="text-link" type="button" onClick={() => field('exercises',draft.exercises.filter((_,i) => i!==index))}>Remove question {index+1}</button></div>
      </fieldset>)}
      {draft.exercises.length<10 && <button className="btn btn-secondary" type="button" onClick={() => field('exercises',[...draft.exercises,blankQuestion()])}>Add question</button>}
     </fieldset><div className="admin-actions">{!draft.locked && !frozen && <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save lesson'}</button>}<button className="text-link" type="button" disabled={busy} onClick={() => setDraft(null)}>Close editor</button></div>
    </form> : <article className="studio-progress-panel"><h2>{course.is_archived ? 'Archived course' : course.is_published ? 'Ready for learners' : 'Build your next lesson'}</h2><p>{course.is_published ? 'This course is visible to learners. Select a lesson to review its content.' : 'Select a lesson to edit, or add a lesson with written material and a knowledge check.'}</p>
     {!course.is_published && <><p>Publishing makes every lesson in this course visible to enrolled learners and locks editing.</p>{confirmPublish ? <div className="admin-notice"><p>Publish {course.title} and all {course.lessons.length} lessons?</p><div className="admin-actions"><button className="btn" disabled={busy} onClick={publish}>{busy ? 'Publishing…' : 'Confirm publish'}</button><button className="text-link" disabled={busy} onClick={() => setConfirmPublish(false)}>Keep as draft</button></div></div> : <button className="btn" disabled={busy || !course.lessons.length} onClick={() => setConfirmPublish(true)}><CheckCircle2 size={17} /> Publish course</button>}</>}
    </article>}
   </div></div>
  </>}
 </section>
}
