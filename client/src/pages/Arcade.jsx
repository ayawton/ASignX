import { useEffect, useReducer, useRef, useState } from 'react'
import { Maximize, Minimize, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import Link from '../components/WorkspaceLink'
import CameraPanel from '../components/CameraPanel'
import { arcadeBestKey, defenseLine, GAME_MODES, PACES, gameReducer, initialGame, readArcadeBest, tickMs } from '../data/arcade'
import { playArcadeCues } from '../data/arcadeSound'
import { createBrowserFrameStream } from '../recognition/browserFrameStream'
import './Arcade.css'

function Ship({ enemy = false }) {
  return <svg className={enemy ? 'strike-enemy-art' : 'strike-player-art'} viewBox="0 0 100 68" fill="none" aria-hidden="true">
    <path d="M50 3 64 23 93 49 94 59 63 50 57 57H43L37 50 6 59 7 49 36 23Z" fill="var(--hull)" stroke="var(--edge)" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M50 3 62 41 57 55H43L38 41Z" fill="var(--panel)" stroke="var(--edge)" strokeWidth="1.2" />
    <path d="m13 51 24-13m26 0 24 13" stroke="var(--edge)" strokeWidth="2" />
    <path d="m45 30 5-9 5 9v11H45Z" fill="var(--light)" />
    <path d="M46 58h8l-4 10Z" fill="var(--light)" />
  </svg>
}

export default function Arcade() {
  const [game, dispatch] = useReducer(gameReducer, undefined, () => initialGame())
  const [input, setInput] = useState('camera')
  const [camera, setCamera] = useState(false)
  const [video, setVideo] = useState(null)
  const [recognition, setRecognition] = useState({ status: 'off', error: '' })
  const [fullscreen, setFullscreen] = useState(false)
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem('asignx-arcade-muted') === 'true' } catch { return false }
  })
  const arena = useRef(null)
  const stream = useRef(null)
  const audio = useRef(null)
  const audioId = useRef(null)
  const nativeFullscreen = useRef(false)
  const settings = PACES[game.pace]
  const playing = game.phase === 'playing'
  const paused = game.phase === 'paused'
  const complete = game.phase === 'complete'
  const counting = game.phase === 'countdown'
  const inRound = playing || paused || counting
  const cameraReady = Boolean(video && recognition.status === 'ready')
  const canPlay = input === 'keyboard' || cameraReady
  const locked = game.targets.find(target => target.id === game.lockedId)
  const seconds = Math.ceil(settings.duration - game.elapsed)
  const time = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0')
  const best = readArcadeBest(game.mode, game.pace, input)

  useEffect(() => {
    if (!video || input !== 'camera') return
    const activeStream = createBrowserFrameStream(video, {
      onState: (status, error = '') => {
        setRecognition({ status, error })
        if (status === 'error') dispatch({ type: 'PAUSE' })
      },
      onResult: result => {
        const emission = result.emissions.find(item => /^[A-IK-Y]$/.test(item.label))
        if (emission) dispatch({ type: 'INPUT', letter: emission.label })
      },
    })
    stream.current = activeStream
    void activeStream.start()
    return () => {
      activeStream.stop()
      stream.current = null
    }
  }, [video, input])

  useEffect(() => {
    if (!canPlay) dispatch({ type: 'PAUSE' })
  }, [canPlay])

  useEffect(() => {
    if (!playing && !counting) return
    const timer = window.setInterval(() => dispatch({ type: 'TICK' }), tickMs)
    return () => window.clearInterval(timer)
  }, [playing, counting])

  useEffect(() => () => { void audio.current?.close().catch(() => {}); audio.current = null }, [])
  useEffect(() => {
    if (!game.audio || audioId.current === game.audio) return
    audioId.current = game.audio
    const context = audio.current
    if (!muted && context && context.state !== 'closed') playArcadeCues(context, game.audio.cues)
  }, [game.audio, muted])

  useEffect(() => {
    function onKey(event) {
      if (input !== 'keyboard' || !playing || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return
      if (event.target instanceof Element && event.target.closest('input, select, textarea, [contenteditable="true"]')) return
      if (/^[a-ik-y]$/i.test(event.key)) {
        event.preventDefault()
        dispatch({ type: 'INPUT', letter: event.key })
      }
    }
    function visibility() {
      if (document.hidden) dispatch({ type: 'PAUSE' })
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [input, playing])

  useEffect(() => {
    function changed() {
      if (document.fullscreenElement === arena.current) nativeFullscreen.current = true
      else if (nativeFullscreen.current) {
        nativeFullscreen.current = false
        setFullscreen(false)
        dispatch({ type: 'PAUSE' })
      }
    }
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  }, [])

  useEffect(() => {
    if (!complete || game.score <= readArcadeBest(game.mode, game.pace, input)) return
    try { localStorage.setItem(arcadeBestKey(game.mode, game.pace, input), String(game.score)) } catch { /* Storage is optional. */ }
  }, [complete, game.score, game.mode, game.pace, input])

  function enterFullscreen() {
    setFullscreen(true)
    const request = arena.current?.requestFullscreen?.()
    request?.catch(() => { /* The viewport-filling layout also works without native fullscreen. */ })
  }

  function exitFullscreen() {
    setFullscreen(false)
    dispatch({ type: 'PAUSE' })
    if (document.fullscreenElement === arena.current) document.exitFullscreen().catch(() => {})
  }

  function play(type) {
    if (!canPlay) return
    if (!muted) unlockAudio()
    stream.current?.clear()
    dispatch({ type, seed: type === 'START' ? Math.floor(Math.random() * 2 ** 32) : undefined })
  }

  function unlockAudio() {
    try {
      audio.current ??= new AudioContext()
      void audio.current.resume().catch(() => {})
    } catch { /* Sound is optional. */ }
  }

  function toggleMute() {
    const next = !muted
    setMuted(next)
    if (!next) unlockAudio()
    else void audio.current?.suspend().catch(() => {})
    try { localStorage.setItem('asignx-arcade-muted', String(next)) } catch { /* Storage is optional. */ }
  }

  function stopCamera() {
    setCamera(false)
    setRecognition({ status: 'off', error: '' })
    stream.current?.stop()
    dispatch({ type: 'PAUSE' })
  }

  return <section className="container strike-page">
    <Link to="/learn" className="text-link">Back to ASignLearn</Link>
    <div ref={arena} className={`strike-arena${fullscreen ? ' is-fullscreen' : ''}${playing ? ' is-playing' : ''}`} aria-label="ASignStrike arena"
      onKeyDown={event => { if (event.key === 'Escape' && fullscreen && !document.fullscreenElement) exitFullscreen() }}>
      <header className="strike-hud">
        <div className="strike-brand"><h1>ASign<span>Strike</span></h1><p>{GAME_MODES[game.mode].title}</p></div>
        <dl className="strike-stats"><div><dt>Score</dt><dd>{game.score}</dd></div><div><dt>{game.mode === 'endless' ? 'Wave' : 'Time'}</dt><dd>{game.mode === 'endless' ? game.wave : time}</dd></div><div><dt>Shields</dt><dd>{game.shields}</dd></div></dl>
        <div className="strike-actions">
          {inRound && <button type="button" disabled={paused && !canPlay} onClick={() => paused ? play('RESUME') : dispatch({ type: 'PAUSE' })}>{paused ? <Play size={16} /> : <Pause size={16} />}<span>{paused ? 'Resume' : 'Pause'}</span></button>}
          <button type="button" aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'} onClick={toggleMute}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
          <button type="button" onClick={fullscreen ? exitFullscreen : enterFullscreen}>{fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}<span>{fullscreen ? 'Exit fullscreen' : 'Fullscreen'}</span></button>
        </div>
      </header>

      <div className="strike-field">
        {game.targets.map(target => <div key={target.id} className={`strike-enemy${target.id === game.lockedId ? ' is-locked' : ''}`} style={{ left: target.x + '%', top: target.y + '%', '--dx': 50 - target.x, '--dy': 82 - target.y }}>
          <Ship enemy />
          <span className="strike-word">{target.word.split('').map((letter, index) => <span key={index} className={index < target.typed ? 'is-done' : target.id === game.lockedId && index === target.typed ? 'is-next' : undefined}>{letter}</span>)}</span>
        </div>)}
        {game.laser && <svg key={game.laser.id} className="strike-shot" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1="50" y1="87" x2={game.laser.x} y2={game.laser.y} vectorEffect="non-scaling-stroke" /></svg>}
        <div className="strike-defense" style={{ top: defenseLine + '%' }} />
        <div className="strike-player"><Ship /><p className="strike-prompt" aria-live="polite">
          {game.lastLetter && (input === 'camera' ? 'Detected ' : 'Typed ') + game.lastLetter + ' · '}
          {locked ? `${input === 'camera' ? 'Sign' : 'Type'} ${locked.word[locked.typed]}` : input === 'camera' ? 'Sign a first letter' : 'Type a first letter'}
        </p></div>
        {inRound && game.feedback && <p className={`strike-feedback is-${game.feedback.tone}`} role="status">{game.feedback.text}</p>}
      </div>

      {input === 'camera' && <aside className="strike-camera">
        <CameraPanel compact active={camera} onStart={() => setCamera(true)} onStop={stopCamera} onVideoReady={setVideo} />
        {camera && recognition.error && <p role="alert">{recognition.error}</p>}
      </aside>}

      {counting && <div className="strike-overlay"><div className="strike-card strike-countdown" role="status">
        <h2>{game.mode === 'endless' ? 'Wave ' + game.wave : 'Get ready'}</h2><strong>{Math.ceil(game.countdown)}</strong>
      </div></div>}

      {game.phase === 'ready' && <div className="strike-overlay">
        <div className="strike-card">
          <h2>Word by word</h2>
          <p>Start with a ship’s first letter to lock on. Finish its word before it reaches the defense line.</p>
          <div className="strike-settings">
            <label>Mode<select value={game.mode} onChange={event => dispatch({ type: 'CONFIGURE', mode: event.target.value })}>{Object.entries(GAME_MODES).map(([key, mode]) => <option key={key} value={key}>{mode.title}</option>)}</select></label>
            <label>Pace<select value={game.pace} onChange={event => dispatch({ type: 'CONFIGURE', pace: event.target.value })}>{Object.entries(PACES).map(([key, pace]) => <option key={key} value={key}>{pace.label}</option>)}</select></label>
            <label>Controls<select value={input} onChange={event => { stopCamera(); setInput(event.target.value) }}><option value="camera">Camera</option><option value="keyboard">Keyboard practice</option></select></label>
          </div>
          {input === 'camera' && <p className="strike-camera-hint" role="status">{cameraReady ? 'Camera ready. Lower your hand briefly before signing the same letter again.' : recognition.status === 'loading' ? 'Loading sign recognition…' : 'Start the camera to enable fingerspelling.'}</p>}
          <button className="strike-primary" type="button" disabled={!canPlay} onClick={() => { if (!fullscreen) enterFullscreen(); play('START') }}>Start round</button>
          <p className="strike-best">Best score · {best}</p>
        </div>
      </div>}

      {paused && <div className="strike-overlay"><div className="strike-card"><h2>Paused</h2>
        {!canPlay && <p>Restart the camera to resume this round.</p>}
        <button className="strike-primary" type="button" disabled={!canPlay} onClick={() => play('RESUME')}>Resume round</button>
        <button className="strike-secondary" type="button" onClick={() => dispatch({ type: 'END' })}>End round</button>
      </div></div>}

      {complete && <div className="strike-overlay"><div className="strike-card"><h2>{game.shields ? 'Round complete' : 'Out of shields'}</h2>
        <p>{game.score} points · {game.cleared} ships cleared</p>
        {game.mode === 'endless' && <p>Highest wave reached · {game.wave}</p>}
        <button className="strike-primary" type="button" disabled={!canPlay} onClick={() => play('START')}>Play again</button>
        <button className="strike-secondary" type="button" onClick={() => dispatch({ type: 'RESET' })}>Round settings</button>
      </div></div>}
    </div>
  </section>
}
