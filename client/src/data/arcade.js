const words = [
  'ANT', 'ARC', 'ASH', 'BAT', 'BEE', 'BOW', 'CAT', 'CUP', 'DAY', 'DOT', 'ELF', 'FAN',
  'GAP', 'HAT', 'ICE', 'KEY', 'MAP', 'NET', 'OAK', 'OWL', 'PEN', 'PIG', 'RAY', 'SEA',
  'SKY', 'SUN', 'TEA', 'TOP', 'VAN', 'WEB', 'WET', 'YAK',
  'BIRD', 'BOAT', 'CAMP', 'CAVE', 'CLAW', 'COAT', 'CORAL', 'DART', 'DAWN', 'DUNE',
  'FIRE', 'FISH', 'FROG', 'GLOW', 'GOLD', 'HAWK', 'HOME', 'KITE', 'LEAF', 'LIFT',
  'MINT', 'MOON', 'MOTH', 'NEST', 'ORCA', 'PATH', 'RAIN', 'RAMP', 'REEF', 'ROCK',
  'SAIL', 'SAND', 'SEAL', 'SHIP', 'SNOW', 'STAR', 'SWAN', 'TIDE', 'VINE', 'WAVE',
  'AMBER', 'APPLE', 'BEACH', 'BLOOM', 'BREAD', 'BRICK', 'CLOUD', 'COMET', 'FLAME',
  'GRAPE', 'GREEN', 'HELLO', 'LIGHT', 'NIGHT', 'ORBIT', 'OTTER', 'PEARL', 'PLANT',
  'RIVER', 'SHELL', 'STORM', 'TRAIL', 'WATER', 'WHEAT', 'BEACON', 'BREECH', 'CANYON',
  'COBALT', 'ECHOES', 'FOREST', 'GALLOP', 'GLIDER', 'HARBOR', 'ISLAND', 'METEOR',
  'NEBULA', 'PEBBLE', 'PLANET', 'ROCKET', 'SHIELD', 'STREAM', 'THRUST', 'VALLEY',
  'CAPTAIN', 'COMETARY', 'CRATER', 'ECLIPSE', 'FALLOUT', 'FIREFLY', 'GRAVITY',
  'LANTERN', 'OUTPOST', 'PHOTON', 'SIGNALS', 'STARDUST', 'THUNDER', 'WILLOW',
].filter(word => /^[A-IK-Y]+$/.test(word))

export const GAME_MODES = {
  letters: { title: 'Alphabet Patrol', targets: ['A', 'B', 'C', 'K', 'L', 'M', 'R', 'S', 'T', 'V'] },
  words: { title: 'Timed Word Defense', targets: words },
  endless: { title: 'Endless Word Defense', targets: words },
}
export const PACES = {
  relaxed: { label: 'Take it easy', speed: 1.8, spawnEvery: 8, duration: 60, shields: 5, maxTargets: 4 },
  challenge: { label: 'Bring it on', speed: 2.5, spawnEvery: 6, duration: 60, shields: 3, maxTargets: 5 },
}

const lanes = [49, 78, 22, 36, 64]
const spawnY = 4
export const defenseLine = 79
export const tickMs = 250
const countdownSeconds = 3

export function makeTarget(id, word, y = spawnY, lane = lanes[(id - 1) % lanes.length]) {
  const x = lane + (50 - lane) * (y - spawnY) / (defenseLine - spawnY)
  return { id, word, typed: 0, x, lane, y }
}

function shuffleWords(pool, seed) {
  const bag = [...pool]
  for (let index = bag.length - 1; index > 0; index--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const other = seed % (index + 1)
    ;[bag[index], bag[other]] = [bag[other], bag[index]]
  }
  return { bag, seed }
}

function spawn(state, { y, lane, carrier = false, deployed = false } = {}) {
  const [min, max] = state.mode === 'letters' ? [1, 1]
    : carrier ? [state.wave >= 10 || state.pace === 'challenge' ? 7 : 6, 8]
      : [3, state.mode === 'endless' && state.wave === 1 ? 3 : 4]
  const eligible = word => word.length >= min && word.length <= max
  const taken = new Set([...state.targets.map(target => target.word), state.lastWord])
  let { bag, seed } = state
  let index = bag.findIndex(word => eligible(word) && !taken.has(word))
  if (index < 0) {
    ;({ bag, seed } = shuffleWords(GAME_MODES[state.mode].targets, seed))
    index = bag.findIndex(word => eligible(word) && !taken.has(word))
  }
  const word = bag[index]
  const target = { ...makeTarget(state.nextId, word, y, lane), carrier, scoutsLaunched: 0 }
  return {
    ...state, bag: bag.filter((_, i) => i !== index), seed, lastWord: word,
    targets: [...state.targets, target], nextId: state.nextId + 1,
    remaining: deployed ? state.remaining : Math.max(0, state.remaining - 1),
    spawnClock: deployed ? state.spawnClock : 0,
    carrierSent: state.carrierSent || carrier,
  }
}

export function initialGame({ mode = 'words', pace = 'relaxed' } = {}) {
  return {
    phase: 'ready', mode, pace, targets: [], nextId: 1, elapsed: 0, spawnClock: 0,
    score: 0, combo: 0, bestCombo: 0, shots: 0, hits: 0, cleared: 0, shields: PACES[pace].shields,
    lockedId: null, laser: null, feedback: null, lastLetter: null, wave: 1, remaining: 0,
    bag: [], seed: 0, lastWord: null, countdown: 0, audio: null, carrierSent: false,
  }
}

function sound(state, ...cues) {
  return { ...state, audio: { id: (state.audio?.id ?? 0) + 1, cues } }
}

function beginFlight(state) {
  const carrier = state.mode === 'endless' && state.wave % 5 === 0
  const first = spawn({ ...state, phase: 'playing', countdown: 0 }, { y: 18, carrier })
  return sound(first, 'launch')
}

function acceptLetter(state, letter) {
  if (typeof letter !== 'string' || !/^[A-IK-Y]$/i.test(letter)) return state
  letter = letter.toUpperCase()
  const eligible = state.targets.filter(target => target.y >= spawnY && target.y < defenseLine)
  const locked = eligible.find(target => target.id === state.lockedId)
  const target = locked ?? eligible.filter(target => target.word[0] === letter)
    .sort((a, b) => b.y - a.y || a.id - b.id)[0]
  const input = { ...state, lastLetter: letter, shots: state.shots + 1 }
  if (!target || target.word[target.typed] !== letter) {
    return {
      ...input, combo: 0,
      feedback: { tone: 'miss', text: locked ? 'Wrong letter' : 'No matching ship', targetId: locked?.id },
    }
  }
  const cleared = target.typed + 1 === target.word.length
  const combo = state.combo + Number(cleared)
  const cues = locked ? ['shot'] : ['lock', 'shot']
  if (cleared) cues.push('clear')
  return sound({
    ...input,
    targets: cleared ? state.targets.filter(ship => ship.id !== target.id)
      : state.targets.map(ship => ship.id === target.id ? { ...ship, typed: ship.typed + 1 } : ship),
    lockedId: cleared ? null : target.id,
    hits: state.hits + 1, cleared: state.cleared + Number(cleared), combo, bestCombo: Math.max(state.bestCombo, combo),
    score: state.score + (cleared ? 100 * Math.min(combo, 5) : 25),
    laser: { id: input.shots, x: target.x, y: target.y, at: state.elapsed },
    feedback: cleared ? { tone: 'hit', text: target.word + ' cleared' } : null,
  }, ...cues)
}

function finish(state, ...cues) {
  return sound({ ...state, phase: 'complete', laser: null }, ...cues, 'end')
}

function advanceFlight(state) {
  const settings = PACES[state.pace]
  const dt = tickMs / 1000
  const elapsed = state.elapsed + dt
  const endless = state.mode === 'endless'
  if (!endless && elapsed >= settings.duration) return finish({ ...state, elapsed: settings.duration })
  const level = endless ? state.wave - 1 : Math.floor(elapsed / 20)
  const speed = Math.min(4.1, settings.speed + level * .28)
  const targets = []
  let lost = 0
  for (const target of state.targets) {
    const y = target.y + speed * (target.carrier ? .65 : 1) * dt
    if (y >= defenseLine) lost++
    else targets.push({ ...target, ...makeTarget(target.id, target.word, y, target.lane), typed: target.typed })
  }
  let next = {
    ...state, targets, elapsed, spawnClock: state.spawnClock + dt,
    shields: Math.max(0, state.shields - lost), combo: lost ? 0 : state.combo,
    lockedId: targets.some(target => target.id === state.lockedId) ? state.lockedId : null,
    laser: state.laser && elapsed - state.laser.at < .4 ? state.laser : null,
  }
  if (!next.shields) return finish(next, 'impact')
  if (lost) next = sound({ ...next, feedback: { tone: 'miss', text: lost === 1 ? 'Shield hit' : lost + ' shield hits' } }, 'impact')
  if (endless && !targets.length && !next.remaining) {
    return sound({ ...next, phase: 'countdown', wave: state.wave + 1, remaining: Math.min(8, state.wave + 1), countdown: countdownSeconds, laser: null, lastLetter: null, feedback: null, carrierSent: false }, ...(lost ? ['impact', 'countdown'] : ['countdown']))
  }
  const carrier = targets.find(target => target.carrier && target.scoutsLaunched < 2 &&
    target.y >= 27 + target.scoutsLaunched * 11)
  if (carrier && targets.length < settings.maxTargets) {
    const side = carrier.scoutsLaunched === 0 ? -1 : 1
    next = {
      ...next,
      targets: targets.map(target => target.id === carrier.id ? { ...target, scoutsLaunched: target.scoutsLaunched + 1 } : target),
    }
    return spawn(next, { y: carrier.y + 3, lane: Math.max(12, Math.min(88, carrier.lane + side * 16)), deployed: true })
  }
  const spawnEvery = endless ? Math.max(3.5, settings.spawnEvery - level * .35) : settings.spawnEvery
  if ((!endless || next.remaining > 0) && (!targets.length || (targets.length < settings.maxTargets && next.spawnClock >= spawnEvery))) {
    const sendCarrier = state.mode === 'words' && !next.carrierSent && elapsed >= 20
    return spawn(next, { carrier: sendCarrier })
  }
  return next
}

export function gameReducer(state, action) {
  switch (action.type) {
    case 'CONFIGURE': return initialGame({ ...state, ...action })
    case 'START': return sound({ ...initialGame(state), phase: 'countdown', countdown: countdownSeconds, remaining: 1, seed: action.seed >>> 0, audio: state.audio }, 'countdown')
    case 'PAUSE':
      return ['playing', 'countdown'].includes(state.phase) ? { ...state, phase: 'paused', pausedPhase: state.phase, laser: null } : state
    case 'RESUME': return state.phase === 'paused' ? { ...state, phase: state.pausedPhase } : state
    case 'END': return ['playing', 'countdown', 'paused'].includes(state.phase) ? finish(state) : state
    case 'RESET': return initialGame(state)
    case 'INPUT': return state.phase === 'playing' ? acceptLetter(state, action.letter) : state
    case 'TICK': {
      if (state.phase === 'playing') return advanceFlight(state)
      if (state.phase !== 'countdown') return state
      const countdown = state.countdown - tickMs / 1000
      if (countdown <= 0) return beginFlight(state)
      const next = { ...state, countdown }
      return Number.isInteger(countdown) ? sound(next, 'countdown') : next
    }
    default: return state
  }
}

export function arcadeBestKey(mode, pace, input) {
  return input === 'keyboard' ? `asignx-arcade-best-${mode}-${pace}` : `asignx-arcade-best-${mode}-${pace}-camera`
}
export function readArcadeBest(mode, pace, input) {
  try { const n = Number(localStorage.getItem(arcadeBestKey(mode, pace, input))); return Number.isFinite(n) && n > 0 ? n : 0 } catch { return 0 }
}
