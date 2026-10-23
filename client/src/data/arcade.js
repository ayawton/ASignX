export const GAME_MODES = {
  letters: { title: 'Alphabet patrol', description: 'One letter. One shot.', targets: ['A', 'B', 'C', 'K', 'L', 'M', 'R', 'S', 'T', 'V'] },
  words: { title: 'Word defense', description: 'Fingerspell each word, one letter at a time.', targets: ['CAT', 'WAVE', 'SUN', 'HELLO', 'STAR', 'MOON', 'HOME', 'SKY'] },
}
export const PACES = {
  relaxed: { label: 'Take it easy', speed: 2.5, spawnEvery: 6, duration: 60, shields: 5, maxTargets: 5 },
  challenge: { label: 'Bring it on', speed: 4, spawnEvery: 4, duration: 60, shields: 3, maxTargets: 6 },
}
const lanes = [20, 51, 79, 35, 66]
export function makeTarget(id, mode, y = 5) {
  const words = GAME_MODES[mode].targets
  return { id, word: words[(id - 1) % words.length], typed: 0, x: lanes[(id - 1) % lanes.length], y }
}
export function initialGame({ mode = 'letters', pace = 'relaxed' } = {}) {
  return { phase: 'ready', mode, pace, targets: [makeTarget(1, mode, 13), makeTarget(2, mode, 30), makeTarget(3, mode, 20)], nextId: 4, elapsed: 0, spawnClock: 0, score: 0, combo: 0, bestCombo: 0, shots: 0, hits: 0, cleared: 0, shields: PACES[pace].shields, lockedId: null, laser: null, feedback: { id: 0, tone: 'neutral', text: 'Your next sign is your next shot.' } }
}
export function nextLetter(state) {
  const locked = state.targets.find(t => t.id === state.lockedId)
  const target = locked || [...state.targets].sort((a, b) => b.y - a.y)[0]
  return target ? target.word[target.typed] : null
}
export function gameReducer(state, action) {
  if (action.type === 'CONFIGURE') return initialGame({ mode: action.mode || state.mode, pace: action.pace || state.pace })
  if (action.type === 'START') return { ...initialGame(state), phase: 'playing' }
  if (action.type === 'PAUSE') return state.phase === 'playing' ? { ...state, phase: 'paused', laser: null } : state
  if (action.type === 'RESUME') return state.phase === 'paused' ? { ...state, phase: 'playing' } : state
  if (action.type === 'END' && ['playing', 'paused'].includes(state.phase)) return { ...state, phase: 'complete', laser: null }
  if (action.type === 'RESET') return initialGame(state)
  if (action.type === 'SELECT' && state.phase === 'playing') return state.targets.some(t => t.id === action.id) ? { ...state, lockedId: action.id } : state
  if (action.type === 'INPUT' && state.phase === 'playing') {
    const letter = action.letter.toUpperCase()
    if (!/^[A-Z]$/.test(letter)) return state
    const locked = state.targets.find(t => t.id === state.lockedId)
    const target = locked || [...state.targets].filter(t => t.word[t.typed] === letter).sort((a,b) => b.y - a.y)[0]
    if (!target || target.word[target.typed] !== letter) return { ...state, shots: state.shots + 1, combo: 0, feedback: { id: state.feedback.id + 1, tone: 'miss', text: `${letter} received. ${locked ? `This target needs ${locked.word[locked.typed]}.` : 'Find a matching target.'}` } }
    const cleared = target.typed + 1 === target.word.length
    const combo = cleared ? state.combo + 1 : state.combo
    return { ...state, targets: cleared ? state.targets.filter(t => t.id !== target.id) : state.targets.map(t => t.id === target.id ? { ...t, typed: t.typed + 1 } : t), lockedId: cleared ? null : target.id, shots: state.shots + 1, hits: state.hits + 1, cleared: state.cleared + Number(cleared), combo, bestCombo: Math.max(state.bestCombo, combo), score: state.score + (cleared ? 100 * Math.min(combo, 5) : 25), laser: { id: state.shots + 1, x: target.x, y: target.y, at: state.elapsed }, feedback: { id: state.feedback.id + 1, tone: 'hit', text: cleared ? `${target.word} cleared! ${combo > 1 ? `${combo} target combo.` : 'Nice shot.'}` : `${letter} received. Next up: ${target.word[target.typed + 1]}.` } }
  }
  if (action.type === 'TICK' && state.phase === 'playing') {
    const settings = PACES[state.pace], dt = .25, elapsed = Math.min(state.elapsed + dt, settings.duration)
    if (elapsed >= settings.duration) return { ...state, elapsed, phase: 'complete', laser: null }
    const wave = Math.floor(elapsed / 20)
    const moved = state.targets.map(t => ({ ...t, y: t.y + settings.speed * (1 + wave * .12) * dt }))
    const lost = moved.filter(t => t.y >= 79), targets = moved.filter(t => t.y < 79)
    const shields = Math.max(0, state.shields - lost.length)
    let spawnClock = state.spawnClock + dt, nextId = state.nextId
    if ((spawnClock >= settings.spawnEvery && targets.length < settings.maxTargets) || targets.length === 0) { targets.push(makeTarget(nextId++, state.mode)); spawnClock = 0 }
    return { ...state, targets, elapsed, spawnClock, nextId, shields, phase: shields ? 'playing' : 'complete', lockedId: targets.some(t => t.id === state.lockedId) ? state.lockedId : null, combo: lost.length ? 0 : state.combo, laser: state.laser && elapsed - state.laser.at < .4 ? state.laser : null, feedback: lost.length ? { id: state.feedback.id + 1, tone: 'miss', text: `${lost.length === 1 ? 'A target slipped through.' : 'Targets slipped through.'} ${shields ? `${shields} shields left.` : 'Time for a fresh start.'}` } : state.feedback }
  }
  return state
}
export function readArcadeBest(mode, pace) {
  try { const n = Number(localStorage.getItem(`asignx-arcade-best-${mode}-${pace}`)); return Number.isFinite(n) && n > 0 ? n : 0 } catch { return 0 }
}
