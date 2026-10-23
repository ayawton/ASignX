import { useState } from 'react'
import { useParams } from 'react-router-dom'
import Link from '../components/WorkspaceLink'
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, Hand, Trophy } from 'lucide-react'
import { Button } from '../components/StudioKit'
import { lessons, completeLesson } from '../data/learning'
import { api } from '../auth'
import { NotFound } from '../Studio'
export default function Lesson() { const { id } = useParams(); return <LessonContent key={id} id={Number(id)} /> }
function LessonContent({ id }) {
  const lesson = lessons[id]
  const [step, setStep] = useState(0)
  const [answer, setAnswer] = useState(null)
  const [correct, setCorrect] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  async function checkAnswer(i) { setAnswer(i); setCorrect(false); setChecking(true); setError(''); try { const result = await api('/practice/check', { method: 'POST', body: JSON.stringify({ lesson_id: id, answer: i }) }); setCorrect(result.correct) } catch (e) { setError(e.message) } finally { setChecking(false) } }
  const [completed, setCompleted] = useState(false)
  if (!lesson) return <NotFound />
  function finish() { completeLesson(id); setCompleted(true) }
  return <section className="container studio-lesson"><Link to="/learn/courses" className="text-link"><ArrowLeft size={16} /> Back to courses</Link><div className="studio-lesson-progress"><span>{lesson.course}</span><span>{completed ? 'Complete' : `Step ${step + 1} of 2`}</span><div className="studio-progress-track"><i style={{ width: completed ? '100%' : `${(step + 1) * 50}%` }} /></div></div><p className="studio-storage-note">Sample practice stays in this browser and does not award account XP or achievements. <Link to="/register">Create an account</Link> to keep a separate verified learning record.</p>{error && <p role="alert">{error}</p>}<article className="studio-lesson-card">{completed ? <div className="studio-complete"><span className="completion-medal"><Trophy size={42} /></span><span className="text-label">One more step forward</span><h1>You made room<br />for a new sign.</h1><p>You completed “{lesson.title}”. Come back to the written guidance whenever you need a refresher.</p><Button to="/learn">Back to your learning studio <ArrowRight size={17} /></Button><button className="text-link" onClick={() => { setCompleted(false); setStep(0); setAnswer(null) }}>Practice again</button></div> : <><span className="text-label">{step === 0 ? 'Get to know the sign' : 'A quick knowledge check'}</span><h1>{step === 0 ? lesson.title : lesson.question}</h1>{step === 0 ? <><div className="studio-lesson-focus"><BookOpen size={36} /><strong>{lesson.focus}</strong><span>Written signing guide</span></div><div className="studio-signing-tip"><Hand size={23} /><div><h3>Give it a try</h3><p>{lesson.tip}</p></div></div><p className="studio-lesson-note">Instructor video is coming soon. This introduction uses written guidance; practice with an ASL instructor for feedback on your signing.</p><button className="btn" onClick={() => setStep(1)}>Check your understanding <ArrowRight size={17} /></button></> : <><div className="studio-answers">{lesson.options.map((o, i) => <button key={o} aria-pressed={answer === i} className={answer === i ? 'is-selected' : ''} disabled={checking} onClick={() => checkAnswer(i)}><span>{String.fromCharCode(65 + i)}</span>{o}{answer === i && <Check size={18} />}</button>)}</div>{answer !== null && !checking && !error && <div className={`studio-feedback ${correct ? 'is-correct' : ''}`} role="status">{correct ? <><CheckCircle2 size={20} /> That’s right. You’ve got the idea!</> : <>Take another look: {lesson.tip}</>}</div>}<div className="studio-lesson-actions"><button className="btn btn-secondary" onClick={() => setStep(0)}><ArrowLeft size={17} /> Review guidance</button><button className="btn" disabled={!correct || checking} onClick={finish}>Complete lesson <Check size={17} /></button></div></>}</>}</article></section>
}
