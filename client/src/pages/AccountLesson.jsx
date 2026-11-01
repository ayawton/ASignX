import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Link from '../components/WorkspaceLink'
import { api } from '../auth'

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
 useEffect(() => {
  let active = true
  api(`/me/lessons/${encodeURIComponent(id)}`).then(value => {
   if (active) { setLesson(value); setError('') }
  }).catch(error => { if (active) setError(error.message) })
  return () => { active = false }
 }, [id, attempt])
 return <section className="container studio-section studio-page">
  {error ? <><h1>Lesson unavailable</h1><p role="alert">{error}</p><button className="btn" type="button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Try again</button><p><Link className="text-link" to="/dashboard">Back to dashboard</Link></p></> : !lesson ? <><h1>Your lesson</h1><p role="status">Loading lesson…</p></> : <>
   <Link className="text-link" to={`/learn/courses/${lesson.course_id}`}>Back to {lesson.course_title}</Link>
   <div className="page-heading"><div><span className="text-label">{lesson.course_title}</span><h1>{lesson.title}</h1><p>{lesson.xp_reward} XP when validated completion becomes available.</p></div></div>
   <article className="studio-lesson-card">
    {!showQuestions ? <>
     <h2>Lesson material</h2>
     {lesson.content ? <p style={{ whiteSpace: 'pre-wrap' }}>{lesson.content}</p> : <p>Written lesson material has not been added yet.</p>}
     {lesson.signs.map(sign => <section key={sign.id} className="studio-signing-tip"><div><h3>{sign.gloss}</h3><p>{sign.meaning}</p>{sign.instructions && <p style={{ whiteSpace: 'pre-wrap' }}>{sign.instructions}</p>}</div></section>)}
     {lesson.exercises.length ? <button className="btn" type="button" onClick={() => setShowQuestions(true)}>View knowledge check</button> : <p>No knowledge-check questions are published for this lesson.</p>}
    </> : <>
     <h2>Knowledge check</h2>
     <p>Selections are temporary. Answer checking and saved completion are not available yet.</p>
     {lesson.exercises.map((exercise, index) => <fieldset key={exercise.id}><legend>{index + 1}. {exercise.prompt}</legend>{exercise.options.length ? exercise.options.map(option => <label key={option.id} style={{ display: 'block', marginBlock: '12px' }}><input type="radio" name={`exercise-${exercise.id}`} value={option.id} checked={answers[exercise.id] === option.id} onChange={() => setAnswers(previous => ({ ...previous, [exercise.id]: option.id }))} /> {option.option_text}</label>) : <p>Answer choices are unavailable.</p>}</fieldset>)}
     <button className="btn btn-secondary" type="button" onClick={() => setShowQuestions(false)}>Review lesson material</button>
    </>}
   </article>
  </>}
 </section>
}
