import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import Link from '../components/WorkspaceLink'
import { api } from '../auth'
import { updateHearts } from '../data/hearts'
import LessonSignAnswer from '../components/LessonSignAnswer'
import SignVideo from '../components/SignVideo'
import { coursePath } from '../data/learningPath'
import LessonJourney from '../components/LessonJourney'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'

export default function AccountLesson(){const {id}=useParams();return <LessonContent key={id} id={id}/>}
function LessonContent({id}){
 const [lesson,setLesson]=useState(null),[run,setRun]=useState(null),[hearts,setHearts]=useState(null)
 const [course,setCourse]=useState(null)
 const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[showQuestions,setShowQuestions]=useState(false),[review,setReview]=useState(false)
 const [index,setIndex]=useState(0),[pending,setPending]=useState(null),[feedback,setFeedback]=useState(null),[retry,setRetry]=useState(0)
 const inFlight=useRef(false),timer=useRef(null),startId=useRef(null),questionHeading=useRef(null),mounted=useRef(true)
 useEffect(()=>()=>{mounted.current=false;clearTimeout(timer.current)},[])
 useEffect(()=>{mounted.current=true;let active=true;api(`/me/lessons/${id}`).then(data=>{if(active){setLesson(data);setRun(data.run);setError('')}}).catch(e=>{if(active)setError(e.message)});api('/me/hearts').then(data=>{if(active){setHearts(data);updateHearts(data)}}).catch(()=>{});return()=>{active=false}},[id,retry])
 useEffect(()=>{if(showQuestions)questionHeading.current?.focus()},[index,showQuestions])
 useEffect(()=>{const listener=event=>setHearts(event.detail);window.addEventListener('asignx-hearts',listener);return()=>window.removeEventListener('asignx-hearts',listener)},[])
 useEffect(()=>{if(!lesson?.course_id)return;let active=true;api(`/me/courses/${lesson.course_id}`).then(value=>{if(active)setCourse(value)}).catch(()=>{});return()=>{active=false}},[lesson?.course_id])
 const path=course?coursePath(course.lessons.map(row=>row.id===id&&run?.completed_at?{...row,completed_at:run.completed_at}:row),id):null
 const question=lesson?.exercises[index],answer=run?.questions.find(q=>q.exercise_id===question?.id)
 const results=Boolean(run?.completed_at && !showQuestions && !review)
 const noHearts=hearts?.hearts===0
 function sync(result){setRun(result.run);if(result.hearts){setHearts(result.hearts);updateHearts(result.hearts)}}
 function advance(nextRun){
  setFeedback(null);setPending(null);setBusy(false);inFlight.current=false
  if(nextRun.completed_at){setShowQuestions(false);setReview(false);return}
  const next=nextRun.questions.find(q=>!q.answered);setIndex(Math.max(0,lesson.exercises.findIndex(q=>q.id===next?.exercise_id)))
 }
 function accept(result){
  sync(result);setMessage('');setFeedback(result.correct?'Correct. Answer saved.':'Not quite. Answer saved; one heart used.')
  timer.current=setTimeout(()=>{if(mounted.current)advance(result.run)},1400)
 }
 async function start(){
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setMessage('')
  if(!startId.current)startId.current=crypto.randomUUID()
  try{
   const result=await api(`/me/lessons/${id}/start`,{method:'POST',body:JSON.stringify({start_id:startId.current})})
   if(!mounted.current)return
   sync(result);startId.current=null;setReview(false)
   if(result.run.completed_at){setShowQuestions(false)}else{const next=result.run.questions.find(q=>!q.answered);setIndex(Math.max(0,lesson.exercises.findIndex(q=>q.id===next?.exercise_id)));setShowQuestions(true)}
  }catch(e){setMessage(e.message);const value=await api('/me/hearts').catch(()=>null);if(value){setHearts(value);updateHearts(value)}}finally{inFlight.current=false;setBusy(false)}
 }
 async function choose(option,submission=pending){
  if(inFlight.current || review || answer?.answered || noHearts)return
  const body=submission?.selected_option_id===option?submission:{run_id:run.id,attempt_id:crypto.randomUUID(),exercise_id:question.id,selected_option_id:option}
  setPending(body);inFlight.current=true;setBusy(true);setMessage('')
  try{const result=await api(`/me/lessons/${id}/attempt`,{method:'POST',body:JSON.stringify(body)});if(mounted.current)accept(result)}
  catch(e){setMessage(e.message);inFlight.current=false;setBusy(false);const value=await api('/me/hearts').catch(()=>null);if(value){setHearts(value);updateHearts(value)}}
 }
 function resume(){api('/me/hearts').then(value=>{setHearts(value);updateHearts(value);setMessage(value.hearts?'You can resume your attempt.':'No hearts yet. Practice or wait for regeneration.')}).catch(e=>setMessage(e.message))}
 return <section className="container studio-section studio-page lesson-experience account-lesson">
  {error?<><h1>Lesson unavailable</h1><p role="alert">{error}</p><button className="btn" onClick={()=>setRetry(v=>v+1)}>Try again</button></>:!lesson?<><h1>Your lesson</h1><p role="status">Loading lesson…</p></>:<>
   <Link className="text-link" to={`/learn/courses/${lesson.course_id}`}>Back to {lesson.course_title}</Link>
   <div className="page-heading"><div><span className="text-label">{lesson.course_title}</span><h1>{lesson.title}</h1><p>Up to {lesson.xp_reward} first-time XP. Perfect-run replays earn 25% of the score’s XP.</p></div></div>
   <LessonJourney stage={results?2:showQuestions?1:0}/>
   {message&&<p className="admin-notice" role="status">{message}</p>}
   <article className="studio-lesson-card">
    {results?<div className="lesson-completion"><span className="lesson-earned-xp">{run.xp_earned} XP earned this run</span><h2>{run.perfect?'Perfect run!':'Lesson completed'}</h2><p>{run.questions.filter(q=>q.correct).length} of {run.questions.length} answers correct.</p><p>{run.replay?'This replay awards 25% of the XP for its correct answers.':run.perfect?'You have perfected this lesson. Future runs award reduced XP.':'You can retry to earn the remaining XP for questions you have not answered correctly yet.'}</p><div className="lesson-navigation">{path?.next&&<Link className="btn" to={`/learn/lessons/${path.next.id}`}>Next lesson: {path.next.title}</Link>}<button className="btn btn-secondary" disabled={busy||noHearts} onClick={start}>{run.perfect||run.replay?'Practice again':'Retry lesson'}</button><button className="btn btn-secondary" onClick={()=>{setReview(true);setIndex(0);setShowQuestions(Boolean(lesson.exercises.length))}}>Review answers</button><button className="text-link" onClick={()=>{setReview(true);setShowQuestions(false)}}>Review material</button><Link className="text-link" to={`/learn/courses/${lesson.course_id}`}>Back to course</Link></div></div>:!showQuestions?<>
     <h2>Lesson material</h2><p style={{whiteSpace:'pre-wrap'}}>{lesson.content||'No written material has been added yet.'}</p>
     {lesson.signs.map(sign=><section className="studio-signing-tip lesson-sign" key={sign.id}><div><h3>{sign.gloss}</h3><p>{sign.meaning}</p>{sign.instructions&&<p style={{whiteSpace:'pre-wrap'}}>{sign.instructions}</p>}<SignVideo path={sign.demo_path} label={sign.gloss} loop autoPlay/></div></section>)}
     <button className="btn" disabled={busy||noHearts} onClick={start}>{busy?'Starting…':run&&!run.completed_at?'Resume attempt':'I’ve reviewed the material · Start'}</button>
    </>:<>
     <h2 className="lesson-check-label" ref={questionHeading} tabIndex={-1}>{review?'Review your answers':'Knowledge check'}</h2><p>Question {index+1} of {lesson.exercises.length}</p><progress className="lesson-question-progress" aria-label="Questions answered" value={run?.questions.filter(q=>q.answered).length||0} max={lesson.exercises.length||1}/>
     <p>{review?'Answers from this run are shown below.':'Choose an answer to check it automatically. Feedback appears briefly before the next question.'}</p>
     {question&&<fieldset className="lesson-question reference-question" key={`${run?.id}:${question.id}`} disabled={busy||review||noHearts||answer?.answered||Boolean(pending&&message)}><legend>{question.prompt}</legend>{question.answer_type==='recognition'?<LessonSignAnswer lessonId={id} runId={run?.id} exercise={{...question,response_text:answer?.response_text,recognition_confidence:answer?.recognition_confidence}} isSolved={Boolean(answer?.answered)} disabled={busy||noHearts} onSolved={result=>{inFlight.current=true;setBusy(true);accept(result)}}/>:question.options.map((option,i)=><label key={option.id}><input className="lesson-choice-radio" type="radio" name={`answer-${question.id}`} checked={(pending?.exercise_id===question.id?pending.selected_option_id:answer?.selected_option_id)===option.id} onChange={()=>choose(option.id)}/><span className="lesson-choice-letter" aria-hidden="true">{String.fromCharCode(65+i)}</span><span className="lesson-choice-text">{option.option_text}</span></label>)}</fieldset>}
     {busy&&pending&&!feedback&&<p role="status">Checking your answer…</p>}
     {feedback&&<div className={`lesson-answer-feedback${answer?.correct?' is-correct':''}`} role="status">{answer?.correct&&<CheckCircle2 size={20}/>}<p>{feedback}</p></div>}
     {review&&answer?.answered&&<p>{answer.correct?'Correct answer saved.':'This answer was incorrect.'}</p>}
     {pending&&message&&!busy&&!answer?.answered&&<button className="btn" onClick={()=>choose(pending.selected_option_id,pending)}>Retry saving answer</button>}
     <div className="lesson-check-actions"><button className="btn btn-secondary" disabled={busy} onClick={()=>{setReview(true);setShowQuestions(false)}}><ArrowLeft size={18}/>Review guidance</button>{review&&<div className="admin-actions"><button className="btn btn-secondary" disabled={index===0} onClick={()=>setIndex(i=>i-1)}>Previous</button>{index<lesson.exercises.length-1?<button className="btn" onClick={()=>setIndex(i=>i+1)}>Next answer</button>:<button className="btn" onClick={()=>{setShowQuestions(false);setReview(false)}}>Back to results</button>}</div>}</div>
    </>}
    {noHearts&&<div className="lesson-heart-pause" role="status"><h3>Your attempt is saved</h3><p>You’re out of hearts. Material and saved answers remain available. Restore a heart to start or continue a graded attempt.</p><Link className="btn" to={`/heart-practice?lesson=${id}`}>Practice to restore a heart</Link><button className="text-link" onClick={resume}>Check regenerated hearts</button></div>}
   </article>
  </>}
 </section>
}
