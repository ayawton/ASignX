import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Link from '../components/WorkspaceLink'
import { api } from '../auth'
import { updateHearts } from '../data/hearts'

export default function Practice() {
 const [search] = useSearchParams()
 const lessonId = search.get('lesson')
 const back = lessonId && /^[0-9a-f-]{36}$/i.test(lessonId) ? `/learn/lessons/${lessonId}` : '/learn'
 const [round, setRound] = useState(null)
 const [feedback, setFeedback] = useState('')
 const [error, setError] = useState('')
 const [busy, setBusy] = useState(false)
 const pending = useRef(null)
 const inFlight = useRef(false)

 async function request(action, body) {
  if (inFlight.current) return
  inFlight.current = true
  setBusy(true)
  setError('')
  setFeedback('')
  try {
   const result = await api(`/me/practice/${action}`, { method: 'POST', body: JSON.stringify(body ?? {}) })
   setRound(result.round)
   updateHearts(result.hearts)
   pending.current = null
   if ('correct' in result && !result.round.completed_at) {
    setFeedback(result.correct ? 'Correct. Keep going.' : 'Not quite. Try another answer.')
   }
  } catch (failure) {
   setError(failure.message)
  } finally {
   inFlight.current = false
   setBusy(false)
  }
 }

 function answer(optionId) {
  pending.current ??= {
   round_id: round.id, question_index: round.question.question_index,
   attempt_id: crypto.randomUUID(), selected_option_id: optionId,
  }
  void request('answer', pending.current)
 }

 return <section className="container studio-section studio-page">
  <Link className="text-link" to={back}>Back to learning</Link>
  <div className="page-heading"><div>
   <h1>Practice</h1>
   <p>Review three questions from completed lessons. If you have fewer than three hearts when you finish, you get one back.</p>
  </div></div>
  {error && <p role="alert">{error}</p>}
  {feedback && <p role="status">{feedback}</p>}
  {round?.completed_at ? <article className="studio-progress-panel">
   <h2>Practice complete</h2>
   <p>Three correct answers.{round.heart_restored && ' You restored one heart.'}</p>
   <div className="lesson-navigation">
    <button className="btn" disabled={busy} onClick={() => request('start')}>Practice again</button>
    <Link className="text-link" to={back}>Continue learning</Link>
   </div>
  </article> : round?.question ? <article className="studio-progress-panel">
   <p>{round.correct_count} of 3 correct</p>
   <h2>{round.question.prompt}</h2>
   <div className="practice-options">
    {round.question.options.map(option => <button className="btn btn-secondary" key={option.id}
     disabled={busy || Boolean(pending.current && pending.current.selected_option_id !== option.id)}
     onClick={() => answer(option.id)}>{option.option_text}</button>)}
   </div>
   {error && <button className="text-link" disabled={busy} onClick={() => request('start')}>Reload round</button>}
  </article> : <button className="btn" disabled={busy} onClick={() => request('start')}>
   {busy ? 'Loading…' : 'Start practice'}
  </button>}
 </section>
}
