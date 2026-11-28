import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Lock } from 'lucide-react'
import { Maximize, Minimize, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import Link from '../components/WorkspaceLink'
import CameraPanel from '../components/CameraPanel'
import PlayerShipSvg from '../components/PlayerShipSvg'
import {
  arcadeAccuracy, arcadeBestKey, ASL_HINTS, defenseLine, GAME_MODES, isMainBossWave, isMiniBossWave,
  PACES, gameReducer, initialGame, readArcadeBest, readHighestArcadeScore, readMothershipDefeated,
  readSelectedShipSkin, SHIP_SKINS, tickMs, unlockedShipSkins,
} from '../data/arcade'
import { playArcadeCues } from '../data/arcadeSound'
import { createBrowserFrameStream } from '../recognition/browserFrameStream'
import './Arcade.css'

function Ship({ enemy = false, carrier = false, boss = false, kind = 'normal', hp = 3, skin = 'classic' }) {
  if (boss) {
    return <svg className={`strike-boss-art${hp <= 2 ? ' is-damaged' : ''}${hp === 1 ? ' is-enraged' : ''}`} viewBox="0 0 1200 160" preserveAspectRatio="none" fill="none" aria-hidden="true">
      {/* Full-width dreadnought outer armor & forward wing fangs */}
      <path d="M0 0 H1200 V46 L1148 118 L1106 78 L1020 96 L976 126 L924 88 L818 102 L772 134 L710 100 L648 116 L600 144 L552 116 L490 100 L428 134 L382 102 L276 88 L224 126 L180 96 L94 78 L52 118 L0 46 Z" fill="var(--hull)" stroke="var(--edge)" strokeWidth="2.8" strokeLinejoin="round" />
      {/* Secondary layered dark-crimson armor plates */}
      <path d="M26 14 H296 L272 78 L188 86 L96 66 L20 42 Z M1174 14 H904 L928 78 L1012 86 L1104 66 L1180 42 Z" fill="var(--panel)" stroke="var(--edge)" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M318 12 H514 L492 90 L388 94 L306 74 Z M882 12 H686 L708 90 L812 94 L894 74 Z" fill="var(--panel)" stroke="var(--edge)" strokeWidth="1.8" strokeLinejoin="round" />
      {/* Ribbed armored vents */}
      <path d="M84 36 H232 M104 52 H214 M968 36 H1116 M986 52 H1096 M354 36 H472 M728 36 H846" stroke="var(--edge)" strokeWidth="1.6" strokeOpacity="0.65" />
      {/* Central command citadel & angry visor eyes */}
      <path d="M524 6 H676 L694 78 L646 112 L600 132 L554 112 L506 78 Z" fill="#260814" stroke="var(--edge)" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M532 42 L584 56 L576 68 L538 56 Z M668 42 L616 56 L624 68 L662 56 Z" fill="var(--light)" />
      <polygon className="strike-boss-core" points="600,26 620,52 600,82 580,52" fill="var(--light)" stroke="#fff0f3" strokeWidth="1.6" />
      {/* Hull damage cracks on Phase 2 and Enraged Phase 3 */}
      {hp <= 2 && <path d="M210 22 L245 58 L225 84 M990 22 L955 58 L975 84 M430 28 L460 66 L445 88" stroke="#ffe66d" strokeWidth="2.5" strokeLinecap="round" />}
      {hp === 1 && <path d="M556 18 L576 48 L560 98 M644 18 L624 48 L640 98 M760 28 L734 68 L754 90" stroke="#ffe66d" strokeWidth="3" strokeLinecap="round" />}
      {/* 9 heavy underside laser cannons spanning edge-to-edge */}
      <g fill="#260814" stroke="var(--edge)" strokeWidth="2">
        <path d="M86 76 H106 L102 124 H90 Z" />
        <path d="M214 92 H236 L232 138 H218 Z" />
        <path d="M332 88 H354 L350 134 H336 Z" />
        <path d="M456 98 H478 L474 146 H460 Z" />
        <path d="M584 114 H616 L610 156 H590 Z" />
        <path d="M722 98 H744 L740 146 H726 Z" />
        <path d="M846 88 H868 L864 134 H850 Z" />
        <path d="M964 92 H986 L982 138 H968 Z" />
        <path d="M1094 76 H1114 L1110 124 H1098 Z" />
      </g>
      {/* Glowing red-hot cannon muzzles */}
      <g fill="var(--light)">
        <rect x="91" y="118" width="10" height="8" rx="2" />
        <rect x="220" y="132" width="10" height="8" rx="2" />
        <rect x="338" y="128" width="10" height="8" rx="2" />
        <rect x="462" y="140" width="10" height="8" rx="2" />
        <rect x="592" y="148" width="16" height="10" rx="3" />
        <rect x="728" y="140" width="10" height="8" rx="2" />
        <rect x="852" y="128" width="10" height="8" rx="2" />
        <rect x="970" y="132" width="10" height="8" rx="2" />
        <rect x="1099" y="118" width="10" height="8" rx="2" />
      </g>
    </svg>
  }
  if (kind === 'dart') {
    return <svg className="strike-enemy-art" viewBox="0 0 100 68" fill="none" aria-hidden="true">
      <path d="M50 2 64 26 78 58 58 48 50 64 42 48 22 58 36 26Z" fill="var(--hull)" stroke="var(--edge)" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M50 10 56 38 50 48 44 38Z" fill="var(--light)" />
    </svg>
  }
  if (!enemy) return <PlayerShipSvg skin={skin} />
  return <svg className="strike-enemy-art" viewBox="0 0 100 68" fill="none" aria-hidden="true">
    {carrier && <g fill="var(--hull)" stroke="var(--edge)" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M22 13 36 24 34 58 5 58 10 29Z M78 13 64 24 66 58 95 58 90 29Z" />
      <path d="M15 34H28V48H15Z M72 34H85V48H72Z" fill="var(--panel)" />
    </g>}
    <path d="M50 3 64 23 93 49 94 59 63 50 57 57H43L37 50 6 59 7 49 36 23Z" fill="var(--hull)" stroke="var(--edge)" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M50 3 62 41 57 55H43L38 41Z" fill="var(--panel)" stroke="var(--edge)" strokeWidth="1.2" />
    <path d="m13 51 24-13m26 0 24 13" stroke="var(--edge)" strokeWidth="2" />
    {kind === 'repair'
      ? <path d="M47 26h6v7h7v6h-7v7h-6v-7h-7v-6h7Z" fill="var(--light)" />
      : kind === 'emp'
        ? <path d="M53 20 42 36h8l-3 14 11-16h-8Z" fill="var(--light)" />
        : <path d="m45 30 5-9 5 9v11H45Z" fill="var(--light)" />}
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
  const [signHints, setSignHints] = useState(true)
  const [unlockedSkins, setUnlockedSkins] = useState(() => unlockedShipSkins())
  const [skin, setSkin] = useState(() => readSelectedShipSkin())
  const [roundStartSkins, setRoundStartSkins] = useState(() => unlockedShipSkins())
  const [roundStartBest, setRoundStartBest] = useState(0)
  const [handShip, setHandShip] = useState({ x: 50, tilt: 0 })
  const [keyShipX, setKeyShipX] = useState(50)
  const handShipRef = useRef({ x: 50, tilt: 0 })
  const playerXRef = useRef(50)
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
  const currentBestKey = arcadeBestKey(game.mode, game.pace, input)
  const savedBest = useMemo(() => readArcadeBest(game.mode, game.pace, input), [game.mode, game.pace, input])
  const best = complete ? Math.max(savedBest, roundStartBest, game.score) : Math.max(savedBest, roundStartBest)
  const isNewBest = complete && game.score > roundStartBest
  const multiplier = Math.max(1, Math.min(game.combo || 1, 5))
  const accuracy = arcadeAccuracy(game)
  const shieldState = game.shields <= 1 ? 'critical' : game.shields <= Math.ceil(settings.shields / 2) ? 'low' : 'steady'
  const impactActive = game.impactAt !== null
  const overdrive = game.combo >= 5
  const empActive = (game.empRemaining ?? 0) > 0
  const dangerVignette = playing && game.shields === 1
  const playerX = input === 'camera' ? handShip.x : keyShipX
  const playerTilt = input === 'camera' ? handShip.tilt : 0
  const aimTarget = locked ?? (game.laser ? { x: game.laser.x, y: game.laser.y } : null)
  const hintTarget = locked ?? [...game.targets].sort((a, b) => b.y - a.y)[0]
  const hintLetter = signHints && playing && hintTarget && (game.elapsed - (game.lastInputAt ?? 0)) >= 3
    ? hintTarget.word[hintTarget.typed]
    : null
  const starSpeed = Math.max(6, 18 - (game.wave - 1) * 1.1)

  useEffect(() => {
    playerXRef.current = playerX
  }, [playerX])

  useEffect(() => {
    if (!video || input !== 'camera') return
    const activeStream = createBrowserFrameStream(video, {
      staticOnly: true,
      onState: (status, error = '') => {
        setRecognition({ status, error })
        if (status === 'error') dispatch({ type: 'PAUSE' })
      },
      onResult: result => {
        if (typeof result.handX === 'number' && Number.isFinite(result.handX)) {
          const targetX = Math.max(16, Math.min(84, 16 + result.handX * 68))
          const prev = handShipRef.current
          const delta = targetX - prev.x
          if (Math.abs(delta) >= 0.7) {
            const nextX = prev.x + delta * 0.42
            const nextTilt = Math.max(-12, Math.min(12, delta * 0.55))
            const next = { x: nextX, tilt: nextTilt }
            handShipRef.current = next
            setHandShip(next)
          } else if (prev.tilt !== 0) {
            const next = { x: prev.x, tilt: 0 }
            handShipRef.current = next
            setHandShip(next)
          }
        }
        const emission = result.emissions.find(item => /^[A-IK-Y]$/.test(item.label))
        if (emission) dispatch({ type: 'INPUT', letter: emission.label, fromX: handShipRef.current.x })
      },
    })
    activeStream.setPaused(true)
    stream.current = activeStream
    void activeStream.start()
    return () => {
      activeStream.stop()
      stream.current = null
    }
  }, [video, input])

  useEffect(() => {
    stream.current?.setPaused(!playing)
  }, [playing])

  useEffect(() => {
    if (!canPlay) dispatch({ type: 'PAUSE' })
  }, [canPlay])

  useEffect(() => {
    if (!playing && !counting) return
    const timer = window.setInterval(() => dispatch({ type: 'TICK', playerX: playerXRef.current }), tickMs)
    return () => window.clearInterval(timer)
  }, [playing, counting])

  useEffect(() => () => { void audio.current?.close().catch(() => {}); audio.current = null }, [])
  useEffect(() => {
    if (!game.audio || audioId.current === game.audio) return
    audioId.current = game.audio
    const context = audio.current
    if (!muted && context && context.state !== 'closed') playArcadeCues(context, game.audio.cues, game.audio.meta)
  }, [game.audio, muted])

  useEffect(() => {
    function onKey(event) {
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return
      if (event.target instanceof Element && event.target.closest('input, select, textarea, [contenteditable="true"]')) return
      if (event.key === 'Escape' && (playing || counting)) {
        event.preventDefault()
        dispatch({ type: 'PAUSE' })
        return
      }
      if (input !== 'keyboard' || !playing) return
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        setKeyShipX(prev => Math.max(16, Math.min(84, prev + (event.key === 'ArrowLeft' ? -10 : 10))))
        return
      }
      if (/^[a-ik-y]$/i.test(event.key)) {
        event.preventDefault()
        dispatch({ type: 'INPUT', letter: event.key, fromX: playerXRef.current })
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
  }, [input, playing, counting, playerX])

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

  const bossDefeatedInRun = game.mode === 'endless' && game.wave > 10
  const effectiveHighest = Math.max(readHighestArcadeScore(), game.score)
  const currentUnlocked = useMemo(
    () => unlockedShipSkins(effectiveHighest, readMothershipDefeated() || bossDefeatedInRun),
    [effectiveHighest, bossDefeatedInRun],
  )
  const newlyUnlockedSkins = complete
    ? SHIP_SKINS.filter(item => currentUnlocked.includes(item.id) && !roundStartSkins.includes(item.id))
    : []

  useEffect(() => {
    if (!complete) return
    if (game.score > readArcadeBest(game.mode, game.pace, input)) {
      try { localStorage.setItem(currentBestKey, String(game.score)) } catch { /* Storage is optional. */ }
    }
    if (bossDefeatedInRun) {
      try { localStorage.setItem('asignx-arcade-boss-defeated', 'true') } catch { /* Storage is optional. */ }
    }
  }, [complete, game.score, game.mode, game.pace, input, currentBestKey, bossDefeatedInRun])

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
    if (type === 'START') {
      const unlocked = unlockedShipSkins()
      setUnlockedSkins(unlocked)
      setRoundStartSkins(unlocked)
      setRoundStartBest(readArcadeBest(game.mode, game.pace, input))
      handShipRef.current = { x: 50, tilt: 0 }
      playerXRef.current = 50
      setHandShip({ x: 50, tilt: 0 })
      setKeyShipX(50)
    }
    dispatch({ type, seed: type === 'START' ? Math.floor(Math.random() * 2 ** 32) : undefined })
  }

  function unlockAudio() {
    try {
      audio.current ??= new AudioContext()
      void audio.current.resume().catch(() => {})
    } catch { /* Sound is optional. */ }
  }

  function selectSkin(nextSkin) {
    if (!currentUnlocked.includes(nextSkin)) return
    setSkin(nextSkin)
    setUnlockedSkins(currentUnlocked)
    try { localStorage.setItem('asignx-arcade-skin', nextSkin) } catch { /* Storage is optional. */ }
  }

  function toggleMute() {
    const next = !muted
    setMuted(next)
    if (!next) unlockAudio()
    else void audio.current?.suspend().catch(() => {})
    try { localStorage.setItem('asignx-arcade-muted', String(next)) } catch { /* Storage is optional. */ }
  }

  const startCamera = useCallback(() => setCamera(true), [])
  const stopCamera = useCallback(() => {
    setCamera(false)
    setRecognition({ status: 'off', error: '' })
    stream.current?.stop()
    dispatch({ type: 'PAUSE' })
  }, [])

  return <section className="container strike-page">
    <Link to="/learn" className="text-link">Back to ASignLearn</Link>
    <div ref={arena} className={`strike-arena${fullscreen ? ' is-fullscreen' : ''}${playing ? ' is-playing' : ''}${impactActive ? ' is-impact' : ''}${overdrive ? ' is-overdrive' : ''}${empActive ? ' is-emp' : ''}${dangerVignette ? ' is-danger' : ''}`} style={{ '--star-speed': `${starSpeed}s` }} aria-label="ASignStrike arena"
      onKeyDown={event => { if (event.key === 'Escape' && fullscreen && !document.fullscreenElement) exitFullscreen() }}>
      <header className="strike-hud">
        <div className="strike-brand"><h1>ASign<span>Strike</span></h1><p>{GAME_MODES[game.mode].title}</p></div>
        <dl className="strike-stats">
          <div><dt>Score</dt><dd>{game.score.toLocaleString()}</dd></div>
          <div className={overdrive ? 'is-max-combo' : multiplier >= 3 ? 'is-hot-combo' : undefined}><dt>Combo</dt><dd key={game.combo}>{overdrive ? '5× OVERDRIVE' : game.combo > 1 ? `${multiplier}×` : '1×'}</dd></div>
          <div><dt>{game.mode === 'endless' ? 'Wave' : 'Time'}</dt><dd>{game.mode === 'endless' ? game.wave : time}</dd></div>
          <div className={`strike-shields-stat is-${shieldState}`}><dt>Shields</dt><dd><span className="strike-shield-pips" aria-hidden="true">{Array.from({ length: settings.shields }, (_, index) => <i key={index} className={index < game.shields ? 'is-on' : undefined} />)}</span><span>{game.shields}</span></dd></div>
        </dl>
        <div className="strike-actions">
          {inRound && <button type="button" disabled={paused && !canPlay} onClick={() => paused ? play('RESUME') : dispatch({ type: 'PAUSE' })}>{paused ? <Play size={16} /> : <Pause size={16} />}<span>{paused ? 'Resume' : 'Pause'}</span></button>}
          <button type="button" aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'} onClick={toggleMute}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
          <button type="button" onClick={fullscreen ? exitFullscreen : enterFullscreen}>{fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}<span>{fullscreen ? 'Exit fullscreen' : 'Fullscreen'}</span></button>
        </div>
      </header>

      <div className="strike-field">
        <div className="strike-stars-fast" aria-hidden="true" />
        {dangerVignette && <div className="strike-danger-vignette" aria-hidden="true" />}
        {empActive && <span className="strike-emp-badge" role="status">EMP SLOW · {Math.ceil(game.empRemaining)}s</span>}
        {game.bossLaser && (game.bossLaser.beams ?? [game.bossLaser.beamX]).map((bx, i) => <div
          key={`${game.bossLaser.id}-${i}`}
          className={`strike-boss-laser is-${game.bossLaser.phase}`}
          style={{ '--beam-x': bx }}
          role={i === 0 && game.bossLaser.phase === 'warning' ? 'alert' : undefined}
        >
          {game.bossLaser.phase === 'warning' && <span className="strike-boss-warn-tag" aria-label="Laser incoming">!</span>}
        </div>)}
        {game.targets.map(target => <div key={target.id} className={`strike-enemy${target.boss ? ' strike-boss' : target.carrier ? ' strike-carrier' : target.kind && target.kind !== 'normal' ? ` strike-${target.kind}` : ''}${target.id === game.lockedId ? ' is-locked' : ''}`} style={{ '--x': target.x, '--y': target.y, '--dx': (game.playerX ?? 50) - target.x, '--dy': 82 - target.y }}>
          <div key={game.feedback?.targetId === target.id ? `miss-${game.shots}` : game.laser?.targetId === target.id ? `hit-${game.laser.id}` : 'steady'}
            className={`strike-enemy-body${game.feedback?.targetId === target.id ? ' is-wrong-letter' : game.laser?.targetId === target.id ? ' is-hit' : ''}`}>
            {target.boss && <div className="strike-boss-hp" aria-label={`Mothership hull ${target.hp} of ${target.maxHp}`}>
              <span>{target.hp === 1 ? 'MOTHERSHIP · ENRAGED' : 'MOTHERSHIP'}</span>
              <div>{Array.from({ length: target.maxHp }, (_, i) => <i key={i} className={i < target.hp ? 'is-on' : undefined} />)}</div>
            </div>}
            {target.kind === 'repair' && <span className="strike-kind-tag is-repair">+SHIELD</span>}
            {target.kind === 'emp' && <span className="strike-kind-tag is-emp">EMP</span>}
            <Ship enemy carrier={target.carrier} boss={target.boss} kind={target.kind} hp={target.hp} />
            <span className="strike-word">{target.word.split('').map((letter, index) => <span key={index} className={index < target.typed ? 'is-done' : target.id === game.lockedId && index === target.typed ? 'is-next' : undefined}>{letter}</span>)}</span>
          </div>
        </div>)}
        {(game.effects ?? []).map(effect => effect.kind === 'burst'
          ? <div key={effect.id} className={`strike-burst${effect.carrier ? ' is-carrier' : ''}${effect.special ? ` is-${effect.special}` : ''}`} style={{ '--x': effect.x, '--y': effect.y, '--delay': `${effect.delay ?? 0}ms` }} aria-hidden="true">
            <span className="strike-burst-ring" />
            <span className="strike-burst-spark s1" /><span className="strike-burst-spark s2" /><span className="strike-burst-spark s3" />
            <span className="strike-burst-spark s4" /><span className="strike-burst-spark s5" /><span className="strike-burst-spark s6" />
            {effect.points && <span className="strike-score-pop">+{effect.points}{effect.combo > 1 ? ` · ${Math.min(effect.combo, 5)}×` : ''}</span>}
          </div>
          : <div key={effect.id} className="strike-breach" style={{ '--x': effect.x, '--y': effect.y }} aria-hidden="true" />
        )}
        {game.laser && <svg key={game.laser.id} className={`strike-shot strike-shot-${skin}${game.laser.overdrive ? ' is-overdrive' : ''}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1={game.laser.fromX ?? playerX} y1="84" x2={game.laser.x} y2={game.laser.y} vectorEffect="non-scaling-stroke" /></svg>}
        <div className={`strike-defense is-${shieldState}${impactActive ? ' is-hit' : ''}`} style={{ top: defenseLine + '%' }} />
        <div
          className={`strike-player${aimTarget ? ' is-aiming' : ''}${overdrive ? ' is-overdrive' : ''}`}
          style={{
            '--px': playerX,
            '--tilt': playerTilt,
            '--aim-dx': aimTarget ? aimTarget.x - playerX : 0,
            '--aim-dy': aimTarget ? aimTarget.y - 84 : -1,
          }}
        >
          <div key={game.laser ? `fire-${game.laser.id}` : 'idle'} className={`strike-player-ship${game.laser ? ' is-firing' : ''}`}>
            <Ship skin={skin} />
          </div>
        </div>
        {hintLetter && ASL_HINTS[hintLetter] && <p className="strike-sign-hint" role="status"><strong>{hintLetter}</strong> · {ASL_HINTS[hintLetter]}</p>}
        <p className="strike-prompt" aria-live="polite">
          {game.lastLetter && (input === 'camera' ? 'Detected ' : 'Typed ') + game.lastLetter + ' · '}
          {locked ? `${input === 'camera' ? 'Sign' : 'Type'} ${locked.word[locked.typed]}` : input === 'camera' ? 'Sign a first letter' : 'Type a first letter'}
        </p>
        {inRound && game.feedback && <p className={`strike-feedback is-${game.feedback.tone}`} role="status">{game.feedback.text}</p>}
      </div>

      {input === 'camera' && <aside className="strike-camera">
        <CameraPanel compact active={camera} onStart={startCamera} onStop={stopCamera} onVideoReady={setVideo} />
        {camera && recognition.error && <p role="alert">{recognition.error}</p>}
      </aside>}

      {counting && <div className="strike-overlay"><div className="strike-card strike-countdown" role="status">
        <h2>{game.mode === 'endless' ? (isMainBossWave(game.wave) ? `Wave ${game.wave} · Mothership` : isMiniBossWave(game.wave) ? `Wave ${game.wave} · Mini-Boss` : `Wave ${game.wave}`) : 'Get ready'}</h2>
        <strong>{Math.ceil(game.countdown)}</strong>
      </div></div>}

      {game.phase === 'ready' && <div className="strike-overlay">
        <div className="strike-card">
          <h2>Word by word</h2>
          <p>Start with a ship’s first letter to lock on. Finish its word before it reaches the defense line.</p>
          <div className="strike-settings">
            <label>Mode<select value={game.mode} onChange={event => dispatch({ type: 'CONFIGURE', mode: event.target.value })}>{Object.entries(GAME_MODES).map(([key, mode]) => <option key={key} value={key}>{mode.title}</option>)}</select></label>
            <label>Pace<select value={game.pace} onChange={event => dispatch({ type: 'CONFIGURE', pace: event.target.value })}>{Object.entries(PACES).map(([key, pace]) => <option key={key} value={key}>{pace.label}</option>)}</select></label>
            <label>Controls<select value={input} onChange={event => { stopCamera(); setInput(event.target.value) }}><option value="camera">Camera</option><option value="keyboard">Keyboard practice</option></select></label>
            <label>Sign hints<select value={signHints ? 'on' : 'off'} onChange={event => setSignHints(event.target.value === 'on')}><option value="on">Show after 3s</option><option value="off">Off</option></select></label>
          </div>
          <div className="strike-skins" role="group" aria-label="Ship skins">
            <span className="strike-skins-label">Ship skin</span>
            <div className="strike-skins-grid">
              {SHIP_SKINS.map(item => {
                const unlocked = currentUnlocked.includes(item.id) || unlockedSkins.includes(item.id)
                const active = skin === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`strike-skin-btn${active ? ' is-selected' : ''}${unlocked ? '' : ' is-locked'}`}
                    disabled={!unlocked}
                    aria-pressed={active}
                    title={unlocked ? item.name : `Unlock: ${item.requirement}`}
                    onClick={() => selectSkin(item.id)}
                  >
                    <Ship skin={item.id} />
                    <span>{item.name}</span>
                    {!unlocked && <small><Lock size={10} aria-hidden="true" /> {item.requirement}</small>}
                  </button>
                )
              })}
            </div>
          </div>
          {input === 'camera' && <p className="strike-camera-hint" role="status">{cameraReady ? 'Camera ready. Lower your hand briefly before signing the same letter again.' : recognition.status === 'loading' ? 'Loading sign recognition…' : 'Start the camera to enable fingerspelling.'}</p>}
          <button className="strike-primary" type="button" disabled={!canPlay} onClick={() => { if (!fullscreen) enterFullscreen(); play('START') }}>Start round</button>
          <p className="strike-best">Best score · {best.toLocaleString()}</p>
        </div>
      </div>}

      {paused && <div className="strike-overlay"><div className="strike-card"><h2>Paused</h2>
        {!canPlay && <p>Restart the camera to resume this round.</p>}
        <div className="strike-card-actions">
          <button className="strike-primary" type="button" disabled={!canPlay} onClick={() => play('RESUME')}>Resume round</button>
          <button className="strike-secondary" type="button" onClick={() => dispatch({ type: 'END' })}>End round</button>
        </div>
      </div></div>}

      {complete && <div className="strike-overlay"><div className="strike-card">
        <div className="strike-complete-head">
          <h2>{game.shields ? 'Round complete' : 'Out of shields'}</h2>
          {isNewBest && <span className="strike-new-best">New best</span>}
        </div>
        <dl className="strike-summary">
          <div><dt>Score</dt><dd>{game.score.toLocaleString()}</dd></div>
          <div><dt>Cleared</dt><dd>{game.cleared}</dd></div>
          <div><dt>Accuracy</dt><dd>{accuracy}%</dd></div>
          <div><dt>Best combo</dt><dd>{game.bestCombo}×</dd></div>
          {game.mode === 'endless' && <div><dt>Highest wave</dt><dd>{game.wave}</dd></div>}
        </dl>
        {newlyUnlockedSkins.length > 0 && (
          <p className="strike-skin-unlock" role="status">
            Ship unlocked: {newlyUnlockedSkins.map(item => item.name).join(', ')}!
          </p>
        )}
        <div className="strike-card-actions">
          <button className="strike-primary" type="button" disabled={!canPlay} onClick={() => play('START')}>Play again</button>
          <button className="strike-secondary" type="button" onClick={() => dispatch({ type: 'RESET' })}>Round settings</button>
        </div>
      </div></div>}
    </div>
  </section>
}
