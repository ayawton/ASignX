import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import Link from '../components/WorkspaceLink'
import { api } from '../auth'
import SignVideo from '../components/SignVideo'

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
 const submissions = useRef({})
 async function action(name, body = {}) {
  if (busy) return
  setBusy(true); setMessage('')
  try {
   const result = await api(`/me/lessons/${id}/${name}`, {method:'POST',body:JSON.stringify(body)})
   if (name==='start') { setLesson(previous => ({...previous,progress:result})); setShowQuestions(true) }
   if (name==='attempt') {
    setLesson(previous => ({...previous,exercises:previous.exercises.map(q => q.id===body.exercise_id ? {...q,solved:q.solved || result.correct} : q)}))
    setMessage(result.correct ? 'Correct. Your answer is saved.' : 'Not quite. Review the material and try again.')
    delete submissions.current[body.exercise_id]
   }
   if (name==='complete') { setLesson(previous => ({...previous,progress:result})); setMessage('Lesson completed. Your progress is saved.') }
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
 return <section className="container studio-section studio-page">
  {error ? <><h1>Lesson unavailable</h1><p role="alert">{error}</p><button className="btn" type="button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Try again</button><p><Link className="text-link" to="/dashboard">Back to dashboard</Link></p></> : !lesson ? <><h1>Your lesson</h1><p role="status">Loading lesson…</p></> : <>
   <Link className="text-link" to={`/learn/courses/${lesson.course_id}`}>Back to {lesson.course_title}</Link>
   <div className="page-heading"><div><span className="text-label">{lesson.course_title}</span><h1>{lesson.title}</h1><p>{lesson.progress?.completed_at ? `Completed · ${lesson.progress.xp_earned} XP earned` : `${lesson.xp_reward} XP on completion`}</p></div></div>
   {message && <p role="status" className="admin-notice">{message}</p>}
   <article className="studio-lesson-card">
    {!showQuestions ? <>
     <h2>Lesson material</h2>
     {lesson.content ? <p style={{ whiteSpace: 'pre-wrap' }}>{lesson.content}</p> : <p>Written lesson material has not been added yet.</p>}
     {lesson.signs.map(sign => <section key={sign.id} className="studio-signing-tip lesson-sign"><div><h3>{sign.gloss}</h3><p>{sign.meaning}</p>{sign.instructions && <p style={{ whiteSpace: 'pre-wrap' }}>{sign.instructions}</p>}<SignVideo path={sign.demo_path} label={sign.gloss} loop autoPlay /></div></section>)}
     <button className="btn" type="button" disabled={busy} onClick={() => action('start')}>I’ve reviewed the material · Continue</button>
    </> : <>
     <h2>Knowledge check</h2>
     <p>{lesson.exercises.length ? 'Answer each question correctly to complete this lesson. Your checked answers are saved to your account.' : 'You’ve reviewed the material. You can now complete this lesson.'}</p>
     {lesson.exercises.map((exercise, index) => <fieldset key={exercise.id} disabled={busy || exercise.solved || Boolean(lesson.progress?.completed_at)}><legend>{index + 1}. {exercise.prompt}</legend>{exercise.options.length ? exercise.options.map(option => <label key={option.id} style={{ display: 'block', marginBlock: '12px' }}><input type="radio" name={`exercise-${exercise.id}`} value={option.id} checked={answers[exercise.id] === option.id} onChange={() => setAnswers(previous => ({ ...previous, [exercise.id]: option.id }))} /> {option.option_text}</label>) : <p>Answer choices are unavailable.</p>}{exercise.solved ? <p>Correct answer saved</p> : <button className="btn btn-secondary" type="button" disabled={!answers[exercise.id]} onClick={() => check(exercise)}>Check answer</button>}</fieldset>)}
     <button className="btn btn-secondary" type="button" onClick={() => setShowQuestions(false)}>Review lesson material</button>
     {!lesson.progress?.completed_at && <button className="btn" type="button" disabled={busy || !lesson.exercises.every(q => q.solved)} onClick={() => action('complete')}>{busy ? 'Saving…' : 'Complete lesson'}</button>}
     {lesson.progress?.completed_at && <p><Link className="text-link" to="/progress">View saved progress</Link></p>}
    </>}
   </article>
  </>}
 </section>
}
