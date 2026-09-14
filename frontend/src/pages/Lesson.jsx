import { useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, ChevronLeft, CircleHelp, Lightbulb, Link2, RotateCcw, Sparkles, Trophy, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Button from '../components/Button'
import CameraPanel from '../components/CameraPanel'
import ProgressBar from '../components/ProgressBar'
import { lessons } from '../data/mockData'

const stages = ['Learn', 'Choose', 'Match', 'Practice', 'Complete']

export default function Lesson() {
  const { id } = useParams()
  return <LessonContent key={id} id={id} />
}

function LessonContent({ id }) {
  const navigate = useNavigate()
  const lesson = lessons[id] || lessons[1]
  const [step, setStep] = useState(0)
  const [answer, setAnswer] = useState('')
  const [matches, setMatches] = useState([])
  const [camera, setCamera] = useState(false)
  const [practiceResult, setPracticeResult] = useState('')
  const progress = (step / (stages.length - 1)) * 100
  const canNext = step === 1 ? answer === 'hello' : step === 2 ? matches.length === 3 : step === 3 ? practiceResult === 'correct' : true

  const toggleMatch = (word) => setMatches(prev => prev.includes(word) ? prev.filter(x => x !== word) : [...prev, word])
  const goNext = () => { if (step < 4 && canNext) setStep(step + 1) }

  return <section className="lesson-page"><div className="shell lesson-shell">
    <div className="lesson-top"><Link to="/learn/courses"><ChevronLeft /> Courses</Link><div className="lesson-top__progress"><span>{lesson.unit} · {stages[step]}</span><ProgressBar value={progress} showValue={false} /></div><span className="lesson-xp"><Sparkles /> +40 XP</span></div>
    <div className="lesson-title"><div><span className="eyebrow">Lesson {id in lessons ? id : 1}</span><h1>{lesson.title}</h1></div><span>Step {step + 1} of {stages.length}</span></div>

    <article className="exercise-card">
      {step === 0 && <div className="learn-exercise"><div className="exercise-heading"><span className="exercise-type">Learn the sign</span><h2>{lesson.focus}</h2><p>Study the movement and shape, then continue when you’re ready.</p></div><div className="demonstration"><div className="demo-stage"><div className="demo-hand">🤟</div><span className="motion-path"><ArrowRight /></span><span className="demo-label">Demonstration placeholder</span></div><div className="meaning-card"><small>Meaning</small><strong>{lesson.meaning}</strong><div><Lightbulb /><p><b>Signing tip</b>{lesson.tip}</p></div><em>Visual sign media will be added during content integration.</em></div></div></div>}

      {step === 1 && <div className="choice-exercise"><div className="exercise-heading center"><span className="exercise-type">Multiple choice</span><h2>Which sign means “Hello”?</h2><p>Select the most accurate visual option.</p></div><div className="sign-options">{['thanks', 'hello', 'please'].map((value, i) => <button key={value} className={`${answer === value ? 'selected' : ''} ${answer && value === 'hello' ? 'correct' : ''} ${answer === value && value !== 'hello' ? 'incorrect' : ''}`} onClick={() => setAnswer(value)}><span>{['🙏', '👋', '🤲'][i]}</span><small>Option {String.fromCharCode(65 + i)}</small>{answer && value === 'hello' && <CheckCircle2 />}{answer === value && value !== 'hello' && <X />}</button>)}</div>{answer && <div className={`feedback ${answer === 'hello' ? 'feedback--correct' : 'feedback--wrong'}`}>{answer === 'hello' ? <CheckCircle2 /> : <CircleHelp />}<div><strong>{answer === 'hello' ? 'That’s right!' : 'Not quite—try another option.'}</strong><span>{answer === 'hello' ? 'This outward wave is a common way to sign hello.' : 'Look for the motion that begins near the forehead.'}</span></div></div>}</div>}

      {step === 2 && <div className="match-exercise"><div className="exercise-heading center"><span className="exercise-type">Match pairs</span><h2>Match each sign with its meaning</h2><p>Select each row to connect the sign and meaning.</p></div><div className="match-board">{[{ sign: '👋', word: 'HELLO' }, { sign: '🙏', word: 'THANK YOU' }, { sign: '👍', word: 'YES' }].map(item => <button onClick={() => toggleMatch(item.word)} className={matches.includes(item.word) ? 'is-matched' : ''} key={item.word}><span>{item.sign}</span><i><Link2 /></i><strong>{item.word}</strong>{matches.includes(item.word) && <Check />}</button>)}</div><p className="match-counter">{matches.length}/3 pairs matched</p></div>}

      {step === 3 && <div className="practice-exercise"><div className="exercise-heading center"><span className="exercise-type">Camera practice · Demo</span><h2>Perform the sign for HELLO</h2><p>Try the sign on camera, then simulate the recognition result.</p></div><div className="practice-grid"><CameraPanel compact active={camera} onStart={() => setCamera(true)} onStop={() => setCamera(false)} /><div className="practice-controls"><Camera /><h3>ML recognition placeholder</h3><p>The future model will evaluate handshape, location, and motion. For now, choose a simulated result.</p><button className="button button--primary full" onClick={() => setPracticeResult('correct')}>Simulate correct sign</button><button className="button button--soft full" onClick={() => setPracticeResult('incorrect')}>Simulate incorrect sign</button>{practiceResult && <div className={`feedback ${practiceResult === 'correct' ? 'feedback--correct' : 'feedback--wrong'}`}>{practiceResult === 'correct' ? <CheckCircle2 /> : <RotateCcw />}<div><strong>{practiceResult === 'correct' ? 'Correct!' : 'Keep practicing'}</strong><span>{practiceResult === 'correct' ? 'Great hand position and movement.' : 'Raise your hand closer to your forehead and try again.'}</span></div></div>}</div></div></div>}

      {step === 4 && <div className="complete-exercise"><div className="confetti">✦ <span>✦</span> ✦</div><div className="complete-icon"><Trophy /></div><span className="exercise-type">Lesson completed</span><h2>Beautiful work!</h2><p>You completed <strong>{lesson.title}</strong> and strengthened your ASL foundation.</p><div className="complete-stats"><div><Sparkles /><strong>40</strong><span>XP earned</span></div><div><CheckCircle2 /><strong>3</strong><span>Exercises</span></div><div><Trophy /><strong>100%</strong><span>Completed</span></div></div><Button to={lesson.next ? `/learn/lesson/${lesson.next}` : '/learn'}>{lesson.next ? 'Continue to next lesson' : 'Back to dashboard'} <ArrowRight size={18} /></Button></div>}
    </article>

    {step < 4 && <div className="lesson-nav"><button className="button button--soft" onClick={() => step ? setStep(step - 1) : navigate('/learn/courses')}><ArrowLeft size={17} /> {step ? 'Previous' : 'Exit lesson'}</button><button className="button button--primary" onClick={goNext} disabled={!canNext}>{step === 3 ? 'Finish lesson' : 'Continue'} <ArrowRight size={17} /></button></div>}
  </div></section>
}
