export const GAME_MODES = {
  letters: { title: 'Alphabet patrol', description: 'One letter. One shot.', targets: ['A', 'B', 'C', 'K', 'L', 'M', 'R', 'S', 'T', 'V'] },
  words: { title: 'Word Defense', description: 'Fingerspell each word, one letter at a time.', targets: ['STAR', 'SUN', 'HELLO', 'CAT', 'WAVE', 'MOON', 'HOME', 'SKY'].filter(word => !/[JZ]/i.test(word)) },
}
export const PACES = {
  relaxed: { label: 'Take it easy', speed: 1.8, spawnEvery: 8, duration: 60, shields: 5, maxTargets: 4 },
  challenge: { label: 'Bring it on', speed: 2.5, spawnEvery: 6, duration: 60, shields: 3, maxTargets: 5 },
}
const lanes = [51, 78, 22, 36, 64]
const arenaEntry = 14
export const defenseLine = 79
export function makeTarget(id, mode, y = -12) {
  const words = GAME_MODES[mode].targets
  const lane = lanes[(id - 1) % lanes.length]
  return { id, word: words[(id - 1) % words.length], typed: 0, x: shipX(lane, y), lane, y }
}
function shipX(lane, y) {
  return lane + (50 - lane) * Math.max(0, (y - arenaEntry) / (defenseLine - arenaEntry))
}
function isAttackable(target) {
  return target.y >= arenaEntry && target.y < defenseLine
}
export function initialGame({ mode = 'words', pace = 'relaxed' } = {}) {
  return { phase: 'ready', mode, pace, targets: [makeTarget(1, mode, 38), makeTarget(2, mode, 22), makeTarget(3, mode, 17)], nextId: 4, elapsed: 0, spawnClock: 0, score: 0, combo: 0, bestCombo: 0, shots: 0, hits: 0, cleared: 0, shields: PACES[pace].shields, lockedId: null, laser: null, feedback: { tone: 'neutral', text: '' } }
}
export function gameReducer(state, action) {
  if (action.type === 'CONFIGURE') return initialGame({ mode: action.mode || state.mode, pace: action.pace || state.pace })
  if (action.type === 'START') return { ...initialGame(state), phase: 'playing' }
  if (action.type === 'PAUSE') return state.phase === 'playing' ? { ...state, phase: 'paused', laser: null } : state
  if (action.type === 'RESUME') return state.phase === 'paused' ? { ...state, phase: 'playing' } : state
  if (action.type === 'END' && ['playing', 'paused'].includes(state.phase)) return { ...state, phase: 'complete', laser: null }
  if (action.type === 'RESET') return initialGame(state)
  if (action.type === 'INPUT' && state.phase === 'playing') {
    const letter = action.letter.toUpperCase()
    if (!/^[A-IK-Y]$/.test(letter)) return state
    const locked = state.targets.find(t => t.id === state.lockedId && isAttackable(t))
    const target = locked || state.targets.filter(t => isAttackable(t) && t.word[0] === letter)
      .sort((a, b) => b.y - a.y || a.id - b.id)[0]
    if (!target || target.word[target.typed] !== letter) return { ...state, shots: state.shots + 1, combo: 0, feedback: { id: state.feedback.id + 1, tone: 'miss', text: `${letter} received. ${locked ? `This target needs ${locked.word[locked.typed]}.` : 'Find a matching target.'}` } }
    const cleared = target.typed + 1 === target.word.length
    const combo = cleared ? state.combo + 1 : state.combo
    return { ...state, targets: cleared ? state.targets.filter(t => t.id !== target.id) : state.targets.map(t => t.id === target.id ? { ...t, typed: t.typed + 1 } : t), lockedId: cleared ? null : target.id, shots: state.shots + 1, hits: state.hits + 1, cleared: state.cleared + Number(cleared), combo, bestCombo: Math.max(state.bestCombo, combo), score: state.score + (cleared ? 100 * Math.min(combo, 5) : 25), laser: { id: state.shots + 1, x: target.x, y: target.y, at: state.elapsed }, feedback: { id: state.feedback.id + 1, tone: 'hit', text: cleared ? `${target.word} cleared! ${combo > 1 ? `${combo} target combo.` : 'Nice shot.'}` : `${letter} received. Next up: ${target.word[target.typed + 1]}.` } }
  }
  if (action.type === 'TICK' && state.phase === 'playing') {
    const settings = PACES[state.pace], dt = .25, elapsed = Math.min(state.elapsed + dt, settings.duration)
    if (elapsed >= settings.duration) return { ...state, elapsed, phase: 'complete', laser: null }
    const wave = Math.floor(elapsed / 20)
    const moved = state.targets.map(t => {
      const y = t.y + settings.speed * (1 + wave * .12) * dt
      return { ...t, y, x: shipX(t.lane, y) }
    })
    const lost = moved.filter(t => t.y >= defenseLine), targets = moved.filter(t => t.y < defenseLine)
    const shields = Math.max(0, state.shields - lost.length)
    let spawnClock = state.spawnClock + dt, nextId = state.nextId
    if ((spawnClock >= settings.spawnEvery && targets.length < settings.maxTargets) || targets.length === 0) { targets.push(makeTarget(nextId++, state.mode)); spawnClock = 0 }
    return { ...state, targets, elapsed, spawnClock, nextId, shields, phase: shields ? 'playing' : 'complete', lockedId: targets.some(t => t.id === state.lockedId) ? state.lockedId : null, combo: lost.length ? 0 : state.combo, laser: state.laser && elapsed - state.laser.at < .4 ? state.laser : null, feedback: lost.length ? { id: state.feedback.id + 1, tone: 'miss', text: `${lost.length === 1 ? 'A target slipped through.' : 'Targets slipped through.'} ${shields ? `${shields} shields left.` : 'Time for a fresh start.'}` } : state.feedback }
  }
  return state
}
export function arcadeBestKey(mode, pace, input) {
  return input === 'keyboard' ? `asignx-arcade-best-${mode}-${pace}` : `asignx-arcade-best-${mode}-${pace}-camera`
}
export function readArcadeBest(mode, pace, input) {
  try { const n = Number(localStorage.getItem(arcadeBestKey(mode, pace, input))); return Number.isFinite(n) && n > 0 ? n : 0 } catch { return 0 }
}
