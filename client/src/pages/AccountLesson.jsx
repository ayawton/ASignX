import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import Link from '../components/WorkspaceLink'
import { api } from '../auth'
import SignVideo from '../components/SignVideo'
import { coursePath, firstUnsolved } from '../data/learningPath'
import LessonJourney from '../components/LessonJourney'
import { ArrowLeft, ArrowRight, Check, CheckCircle2 } from 'lucide-react'

export default function AccountLesson() {
 const { id } = useParams()
 return <LessonContent key={id} id={id} />
}

function LessonContent({ id }) {
 const [lesson, setLesson] = useState(null)
 const [error, setError] = useState('')
 const [attempt, setAttempt] = useState(0)
 const [showQuestions, setShowQuestions] = useState(false)
 const [answers, setAnswers] = useState({})
 const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
 const [questionIndex,setQuestionIndex] = useState(0), [review,setReview] = useState(false)
 const [course,setCourse] = useState(null), [courseError,setCourseError] = useState('')
 const questionHeading = useRef(null)
 const exercise = lesson?.exercises[questionIndex]
 const completed = Boolean(lesson?.progress?.completed_at)
 const path = course ? coursePath(course.lessons.map(row=>row.id===id && completed ? {...row,completed_at:lesson.progress.completed_at}:row),id) : null
 const submissions = useRef({})
 async function action(name, body = {}) {
  if (busy) return
  setBusy(true); setMessage('')
  try {
   const result = await api(`/me/lessons/${id}/${name}`, {method:'POST',body:JSON.stringify(body)})
   if (name==='start') { setLesson(previous => ({...previous,progress:result})); setQuestionIndex(firstUnsolved(lesson.exercises)); setShowQuestions(true) }
   if (name==='attempt') {
    setLesson(previous => ({...previous,exercises:previous.exercises.map(q => q.id===body.exercise_id ? {...q,solved:q.solved || result.correct} : q)}))
    setMessage(result.correct ? 'Correct. Your answer is saved.' : 'Not quite. Review the material and try again.')
    delete submissions.current[body.exercise_id]
   }
   if (name==='complete') { setLesson(previous => ({...previous,progress:result})); setReview(false); setMessage('Lesson completed. Your progress is saved.') }
  } catch(e) { setMessage(e.message) } finally { setBusy(false) }
 }
 function check(q) {
  const option = answers[q.id]
  if (!option) return
  const previous = submissions.current[q.id]
  const submission = previous?.selected_option_id===option ? previous : {attempt_id:crypto.randomUUID(),exercise_id:q.id,selected_option_id:option}
  submissions.current[q.id] = submission
  action('attempt',submission)
 }
 useEffect(() => {
  let active = true
  api(`/me/lessons/${encodeURIComponent(id)}`).then(value => {
   if (active) { setLesson(value); setAnswers(Object.fromEntries(value.exercises.filter(q => q.selected_option_id).map(q => [q.id,q.selected_option_id]))); setError('') }
  }).catch(error => { if (active) setError(error.message) })
  return () => { active = false }
 }, [id, attempt])
 useEffect(()=>{
  if(!lesson?.course_id)return
  let active=true
  api(`/me/courses/${lesson.course_id}`).then(value=>{if(active){setCourse(value);setCourseError('')}}).catch(()=>{if(active)setCourseError('The next lesson could not load. Return to the course to continue.')})
  return()=>{active=false}
 },[lesson?.course_id])
 useEffect(()=>{if(showQuestions)questionHeading.current?.focus()},[questionIndex,showQuestions])
 return <section className="container studio-section studio-page lesson-experience account-lesson">
  {error ? <><h1>Lesson unavailable</h1><p role="alert">{error}</p><button className="btn" type="button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Try again</button><p><Link className="text-link" to="/dashboard">Back to dashboard</Link></p></> : !lesson ? <><h1>Your lesson</h1><p role="status">Loading lesson…</p></> : <>
   <Link className="text-link" to={`/learn/courses/${lesson.course_id}`}>Back to {lesson.course_title}</Link>
   <div className="page-heading"><div><span className="text-label">{lesson.course_title}</span><h1>{lesson.title}</h1><p>{lesson.progress?.completed_at ? `Completed · ${lesson.progress.xp_earned} XP earned` : `${lesson.xp_reward} XP on completion`}</p></div></div>
   <LessonJourney stage={completed&&!review?2:showQuestions?1:0} />
   {message && (!showQuestions || completed&&!review) && <p role="status" className="admin-notice">{message}</p>}
   <article className="studio-lesson-card">
    {completed && !review ? <div className="lesson-completion">
     <span className="lesson-earned-xp">{lesson.progress.xp_earned} XP earned</span><h2>Lesson complete</h2><p>You completed “{lesson.title}”. Your answers and progress are saved.</p>
     {path&&<p>{path.completed} of {path.total} course lessons completed.</p>}
     {path?.completed===path?.total&&path&&<p>You’ve completed every published lesson in this course.</p>}
     {courseError&&<p role="status">{courseError}</p>}
     <div className="lesson-navigation">{path?.next?<Link className="btn" to={`/learn/lessons/${path.next.id}`}>Next lesson: {path.next.title}</Link>:<Link className="btn" to={`/learn/courses/${lesson.course_id}`}>Back to course</Link>}<button className="btn btn-secondary" type="button" onClick={()=>{setReview(true);setShowQuestions(false);setMessage('')}}>Review lesson</button></div><Link className="text-link" to="/progress">View saved progress</Link>
    </div> : !showQuestions ? <>
     <h2>Lesson material</h2>
     {lesson.content ? <p style={{ whiteSpace: 'pre-wrap' }}>{lesson.content}</p> : <p>Written lesson material has not been added yet.</p>}
     {lesson.signs.map(sign => <section key={sign.id} className="studio-signing-tip lesson-sign"><div><h3>{sign.gloss}</h3><p>{sign.meaning}</p>{sign.instructions && <p style={{ whiteSpace: 'pre-wrap' }}>{sign.instructions}</p>}<SignVideo path={sign.demo_path} label={sign.gloss} loop autoPlay /></div></section>)}
     <button className="btn" type="button" disabled={busy} onClick={() => completed ? (setQuestionIndex(0),setShowQuestions(true)) : action('start')}>{completed ? 'Review saved answers' : 'I’ve reviewed the material · Continue'}</button>
    </> : <>
     <h2 className="lesson-check-label" ref={questionHeading} tabIndex={-1}>A quick knowledge check</h2>
     {exercise&&<><p>Question {questionIndex+1} of {lesson.exercises.length}</p><progress aria-label="Questions answered correctly" value={lesson.exercises.filter(q=>q.solved).length} max={lesson.exercises.length}/></>}
     <p>{lesson.exercises.length ? 'Answer each question correctly to complete this lesson. Your checked answers are saved to your account.' : 'You’ve reviewed the material. You can now complete this lesson.'}</p>
     {exercise&&<fieldset className="lesson-question reference-question" key={exercise.id} disabled={busy || exercise.solved || completed}><legend>{exercise.prompt}</legend>{exercise.options.length ? exercise.options.map((option,index) => <label key={option.id}><input className="lesson-choice-radio" type="radio" name={`exercise-${exercise.id}`} value={option.id} checked={answers[exercise.id] === option.id} onChange={() => {setAnswers(previous => ({ ...previous, [exercise.id]: option.id }));setMessage('')}} /><span className="lesson-choice-letter" aria-hidden="true">{String.fromCharCode(65+index)}</span><span className="lesson-choice-text">{option.option_text}</span>{answers[exercise.id]===option.id&&<Check size={22} aria-hidden="true" />}</label>) : <p>Answer choices are unavailable.</p>}</fieldset>}
     {(exercise?.solved || message)&&<div className={`lesson-answer-feedback${exercise?.solved?' is-correct':''}`} role="status">{exercise?.solved&&<CheckCircle2 size={22} aria-hidden="true" />}<p>{exercise?.solved?'That’s right. Your correct answer is saved.':message}</p></div>}
     <div className="lesson-check-actions"><div className="lesson-review-actions"><button className="btn btn-secondary" type="button" disabled={busy} onClick={() => {setShowQuestions(false);setMessage('')}}><ArrowLeft size={18} />Review guidance</button>{questionIndex>0&&<button className="text-link" type="button" disabled={busy} onClick={()=>{setMessage('');setQuestionIndex(i=>i-1)}}>Previous question</button>}</div>
      {exercise&&!exercise.solved&&!completed?<button className="btn" type="button" disabled={busy||!answers[exercise.id]} onClick={()=>check(exercise)}>{busy?'Checking…':'Check answer'}<Check size={18}/></button>:questionIndex<lesson.exercises.length-1?<button className="btn" type="button" disabled={busy} onClick={()=>{setMessage('');setQuestionIndex(i=>i+1)}}>Next question<ArrowRight size={18}/></button>:!completed?<button className="btn" type="button" disabled={busy||!lesson.exercises.every(q=>q.solved)} onClick={()=>action('complete')}>{busy?'Saving…':'Complete lesson'}<Check size={18}/></button>:<button className="btn" type="button" onClick={()=>setReview(false)}>Back to completion<Check size={18}/></button>}
     </div>
     {lesson.progress?.completed_at && <p><Link className="text-link" to="/progress">View saved progress</Link></p>}
    </>}
   </article>
  </>}
 </section>
}
