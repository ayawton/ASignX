import { useEffect, useReducer, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, Camera, Check, ChevronRight, Crosshair, Hand, Heart, Keyboard, Pause, Play, RotateCcw, Shield, Sparkles, Target, Trophy, X, Zap } from 'lucide-react'
import CameraPanel from '../components/CameraPanel'
import LearningModes from '../components/LearningModes'
import { GAME_MODES, PACES, gameReducer, initialGame, nextLetter, readArcadeBest } from '../data/arcade'
import './Arcade.css'

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
function Ship() { return <svg viewBox="0 0 90 90" fill="none" aria-hidden="true"><path d="M45 8 76 68 53 61 45 76 37 61 14 68Z" fill="#2962F5" stroke="#AFC5ED" strokeWidth="2" strokeLinejoin="round"/><path d="m45 24 8 25H37z" fill="#FFE66D"/><path d="m37 73 8 12 8-12" stroke="#FFE66D" strokeWidth="3" strokeLinecap="round"/><path d="m22 56 15-5m31 5-15-5" stroke="#8FB2FF" strokeWidth="2"/></svg> }
function SkyPreview() { return <div className="arcade-orbit" aria-hidden="true"><span /><span /><span /><Crosshair size={45} /></div> }

export default function Arcade() {
  const [game, dispatch] = useReducer(gameReducer, undefined, () => initialGame())
  const [camera, setCamera] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const settings = PACES[game.pace]
  const playing = game.phase === 'playing', paused = game.phase === 'paused', complete = game.phase === 'complete'
  const inRound = playing || paused
  const suggested = nextLetter(game)
  const locked = game.targets.find(t => t.id === game.lockedId)
  const accuracy = game.shots ? Math.round(game.hits / game.shots * 100) : 0
  const seconds = Math.ceil(settings.duration - game.elapsed)
  const best = Math.max(readArcadeBest(game.mode, game.pace), complete ? game.score : 0)

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => dispatch({ type: 'TICK' }), 250)
    return () => window.clearInterval(timer)
  }, [playing])
  useEffect(() => {
    function onKey(event) {
      if (event.ctrlKey || event.altKey || event.metaKey || event.repeat) return
      if (event.target instanceof Element && event.target.closest('input,select,textarea,[contenteditable="true"]')) return
      if (event.key === 'Escape') { if (playing || paused) { event.preventDefault(); dispatch({ type: playing ? 'PAUSE' : 'RESUME' }) } }
      else if (playing && /^[a-z]$/i.test(event.key)) { event.preventDefault(); dispatch({ type: 'INPUT', letter: event.key }) }
    }
    function visibility() { if (document.hidden) dispatch({ type: 'PAUSE' }) }
    window.addEventListener('keydown', onKey)
    document.addEventListener('visibilitychange', visibility)
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', visibility) }
  }, [playing, paused])
  useEffect(() => {
    if (!complete || game.score <= readArcadeBest(game.mode, game.pace)) return
    try { localStorage.setItem(`asignx-arcade-best-${game.mode}-${game.pace}`, String(game.score)) } catch { /* A round can be played without browser storage. */ }
  }, [complete, game.score, game.mode, game.pace])

  return <section className="container arcade-page">
    <div className="arcade-breadcrumb"><span>ASign Learn <ChevronRight size={13} /> Arcade</span><Link to="/learn" className="text-link"><ArrowLeft size={14} /> Your learning studio</Link></div>
    <LearningModes />
    <div className="arcade-heading"><div><div className="arcade-title"><span><Crosshair size={27} /></span><h1>Sign Strike</h1><span className="arcade-preview-tag">UI preview</span></div><p>Ready. Sign. Fire. A little fingerspelling, a whole new way to practice.</p></div><button className="arcade-guide-button" onClick={() => setShowGuide(!showGuide)} aria-expanded={showGuide} aria-controls="arcade-guide"><BookOpen size={16} /> How to play</button></div>
    <div className="arcade-prototype-note"><Sparkles size={16} /><p><strong>Try the game before recognition arrives.</strong> Use the demo keys below or your keyboard to simulate signs. Your camera does not control the game yet.</p></div>
    {showGuide && <div className="arcade-guide" id="arcade-guide"><div><span><Target size={20} /></span><h3>Pick a target</h3><p>Sign its first letter to lock on, or select the target yourself.</p></div><div><span><Hand size={20} /></span><h3>Sign to fire</h3><p>In Alphabet patrol, one letter clears a target. In Word defense, fingerspell the letters in order.</p></div><div><span><Shield size={20} /></span><h3>Protect your space</h3><p>Clear targets before they reach the defense line. Keep your combo going for bonus points.</p></div><button aria-label="Close instructions" onClick={() => setShowGuide(false)}><X size={17} /></button></div>}
    <div className="arcade-workspace">
      <div className="arcade-main">
        <div className="arcade-toolbar"><div className="arcade-selects"><label>Game mode<select value={game.mode} disabled={inRound} onChange={e => dispatch({ type: 'CONFIGURE', mode: e.target.value })}>{Object.entries(GAME_MODES).map(([key,mode]) => <option key={key} value={key}>{mode.title}</option>)}</select></label><label>Pace<select value={game.pace} disabled={inRound} onChange={e => dispatch({ type: 'CONFIGURE', pace: e.target.value })}>{Object.entries(PACES).map(([key,pace]) => <option key={key} value={key}>{pace.label}</option>)}</select></label></div><span className="arcade-best"><Trophy size={15} /><span>Best demo score<strong>{best.toLocaleString()}</strong></span></span></div>
        <div className={`arcade-arena arcade-arena--${game.phase}`} aria-label="Sign Strike target arena">
          <div className="arcade-stars" aria-hidden="true" />
          <div className="arcade-hud"><div><span>Score</span><strong>{game.score.toLocaleString().padStart(4, '0')}</strong></div><div><span>Combo</span><strong className={game.combo > 1 ? 'is-hot' : ''}>{game.combo}<small>×</small></strong></div><div className="arcade-wave"><span>Wave</span><strong>{Math.min(3, Math.floor(game.elapsed / 20) + 1).toString().padStart(2,'0')}</strong></div><div className="arcade-shields"><span>Shields</span><div aria-label={`${game.shields} of ${settings.shields} shields remaining`}>{Array.from({length:settings.shields},(_,i)=><Heart key={i} size={14} fill={i < game.shields ? 'currentColor' : 'none'} className={i < game.shields ? '' : 'is-lost'} />)}</div></div><div className="arcade-clock"><span>Time left</span><strong>{String(Math.floor(seconds / 60)).padStart(2,'0')}:{String(seconds % 60).padStart(2,'0')}</strong></div></div>
          <div className="arcade-flight-zone">
            {game.targets.map(target => <button key={target.id} className={`arcade-target${target.id === game.lockedId ? ' is-locked' : ''}${target.y > 61 ? ' is-close' : ''}`} style={{left:`${target.x}%`,top:`${target.y}%`}} disabled={!playing} onClick={() => dispatch({type:'SELECT',id:target.id})} aria-label={`Target ${target.word}. Next letter ${target.word[target.typed]}. Select to lock on.`}><span className="arcade-target-shape"><span /><span /><span /></span><span className="arcade-target-word"><span>{target.word.slice(0,target.typed)}</span>{target.word.slice(target.typed)}</span>{target.id === game.lockedId && <small><Crosshair size={9} /> Locked on</small>}</button>)}
            {game.laser && <svg key={game.laser.id} className="arcade-laser" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1="50" y1="91" x2={game.laser.x} y2={game.laser.y + 5} stroke="#FFE66D" strokeWidth=".4" vectorEffect="non-scaling-stroke" /><line x1="50" y1="91" x2={game.laser.x} y2={game.laser.y + 5} stroke="#FFE66D" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>}
            <div className="arcade-defense-line"><span>Defense line</span></div>
            <div className={`arcade-ship${game.laser ? ' is-firing' : ''}`}><Ship /></div>
          </div>
          {game.phase === 'ready' && <div className="arcade-overlay"><div className="arcade-overlay-card"><SkyPreview /><span className="arcade-overlay-label">Your hands. Your superpower.</span><h2>Clear skies ahead.</h2><p>{GAME_MODES[game.mode].description} Clear the targets before they reach your ship.</p><button className="btn arcade-start" onClick={() => dispatch({type:'START'})}><Play size={16} fill="currentColor" /> Start round</button><span className="arcade-overlay-note">60 seconds · {settings.shields} shields · Camera optional</span></div></div>}
          {paused && <div className="arcade-overlay"><div className="arcade-overlay-card"><span className="arcade-pause-symbol"><Pause size={30} /></span><span className="arcade-overlay-label">Take your time.</span><h2>A little breather.</h2><p>Your targets can wait. Pick up right where you left off.</p><button className="btn arcade-start" onClick={() => dispatch({type:'RESUME'})}><Play size={16} fill="currentColor" /> Resume round</button><button className="arcade-overlay-link" onClick={() => dispatch({type:'END'})}>End this round</button></div></div>}
          {complete && <div className="arcade-overlay"><div className="arcade-overlay-card arcade-results"><span className="arcade-result-trophy"><Trophy size={34} /></span><span className="arcade-overlay-label">{game.shields ? 'Round complete' : 'Out of shields. Still in the game.'}</span><h2>{game.cleared ? 'Look at you go.' : 'Every pilot starts somewhere.'}</h2><strong className="arcade-final-score">{game.score.toLocaleString()}<small>demo points</small></strong><div className="arcade-result-stats"><div><strong>{game.cleared}</strong><span>Targets cleared</span></div><div><strong>{accuracy}%</strong><span>Input accuracy</span></div><div><strong>{game.bestCombo}×</strong><span>Best combo</span></div></div><button className="btn arcade-start" onClick={() => dispatch({type:'START'})}><RotateCcw size={16} /> Play another round</button><button className="arcade-overlay-link" onClick={() => dispatch({type:'RESET'})}>Change game mode</button><span className="arcade-overlay-note">Demo scores are separate from your lesson progress.</span></div></div>}
          <div className="arcade-arena-bottom"><span><i /> {playing ? 'Round in progress' : paused ? 'Round paused' : complete ? 'Round complete' : 'Ready when you are'}</span><span><Keyboard size={12} /> {playing || paused ? 'Esc to pause / resume' : 'A–Z to simulate signs'}</span></div>
        </div>
        <div className="arcade-control-bar"><p className={`arcade-feedback arcade-feedback--${game.feedback.tone}`} role="status">{game.feedback.tone === 'hit' ? <Check size={16} /> : <Crosshair size={16} />}{game.feedback.text}</p><div><button className="arcade-quick-fire" disabled={!playing || !suggested} onClick={() => dispatch({type:'INPUT',letter:suggested})}><Zap size={12} /> Send {suggested || 'sign'}</button>{inRound && <button className="arcade-utility" onClick={() => dispatch({type:paused ? 'RESUME' : 'PAUSE'})}>{paused ? <Play size={15} /> : <Pause size={15} />}{paused ? 'Resume' : 'Pause'}</button>}<button className="arcade-utility" disabled={game.phase === 'ready'} onClick={() => dispatch({type:'RESET'})}><RotateCcw size={15} /> Reset</button></div></div>
      </div>
      <aside className="arcade-sidebar">
        <section className="arcade-camera-panel"><div className="arcade-side-heading"><h2><Camera size={16} /> Your signing space</h2><span>Preview</span></div><CameraPanel active={camera} onStart={() => setCamera(true)} onStop={() => setCamera(false)} /><p className="arcade-camera-note">Camera preview only. Sign recognition isn’t connected.</p></section>
        <section className="arcade-input-panel"><div className="arcade-side-heading"><h2><Hand size={17} /> Demo sign input</h2><span>Simulated</span></div><div className="arcade-next-sign"><span>{locked ? `Locked target: ${locked.word}` : 'Suggested next letter'}<strong>{suggested || '…'}</strong></span><button className="btn" disabled={!playing || !suggested} onClick={() => dispatch({type:'INPUT',letter:suggested})}><Zap size={15} /> Send {suggested || 'sign'}</button></div><p>Tap a letter or press A–Z on your keyboard to simulate a recognized sign.</p><div className="arcade-keyboard" aria-label="Simulated sign letters">{alphabet.map(letter=><button key={letter} disabled={!playing} className={letter === suggested && playing ? 'is-suggested' : ''} onClick={() => dispatch({type:'INPUT',letter})} aria-label={`Simulate sign ${letter}`}>{letter}</button>)}</div><div className="arcade-input-status"><i />{playing ? 'Demo input ready' : paused ? 'Input paused' : 'Start a round to enable input'}</div></section>
        <div className="arcade-practice-tip"><span><Sparkles size={19} /></span><div><strong>Practice, then put it into play.</strong><p>Get familiar with the alphabet before testing your reflexes.</p><Link to="/learn/lesson/1">Visit the alphabet module <ArrowRight size={13} /></Link></div></div>
      </aside>
    </div>
    <div className="arcade-bottom-note"><Shield size={15} /><p>This is a playable UI demo. Scores measure simulated inputs, not signing skill. The future recognition model will replace the demo controls.</p></div>
  </section>
}
