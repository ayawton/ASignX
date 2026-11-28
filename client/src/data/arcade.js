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

export const ASL_HINTS = {
  A: 'Closed fist, thumb resting upright along the side',
  B: 'Four fingers straight up together, thumb tucked across palm',
  C: 'Curve thumb and fingers into a C shape',
  D: 'Index finger straight up, thumb touches middle fingertip',
  E: 'Curl all fingertips down onto your tucked thumb',
  F: 'Touch thumb and index tips in a circle, other three fingers up',
  G: 'Point index finger sideways, thumb parallel behind it',
  H: 'Index and middle fingers extended sideways together',
  I: 'Closed fist with only your pinky finger straight up',
  K: 'Index and middle up in a V, thumb tucked between them',
  L: 'Index finger up and thumb out in an L shape',
  M: 'Thumb tucked under index, middle, and ring fingers',
  N: 'Thumb tucked under index and middle fingers',
  O: 'Curve all fingertips to meet your thumb in an O',
  P: 'K handshape angled downward',
  Q: 'G handshape angled downward',
  R: 'Cross middle finger behind your index finger',
  S: 'Closed fist with thumb wrapped across the front of fingers',
  T: 'Closed fist with thumb tucked between index and middle',
  U: 'Index and middle fingers held straight up together',
  V: 'Index and middle fingers up and spread in a V',
  W: 'Index, middle, and ring fingers up and spread apart',
  X: 'Index finger bent into a hook, other fingers closed',
  Y: 'Thumb and pinky extended out, middle three fingers folded',
}

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
const feedbackLifetime = 1.8
const bossHoverY = 17
const bossWarningDuration = 2.25
const bossFireDuration = 0.75
const bossBeamHalfWidth = 8.5
const empDuration = 5

export function isMiniBossWave(wave) {
  return wave > 0 && wave % 10 === 5
}

export function isMainBossWave(wave) {
  return wave > 0 && wave % 10 === 0
}

export function makeTarget(id, word, y = spawnY, lane = lanes[(id - 1) % lanes.length]) {
  const x = lane + (50 - lane) * 0.45 * (y - spawnY) / (defenseLine - spawnY)
  return { id, word, typed: 0, x, lane, y }
}

function nextRandom(seed) {
  const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return { seed: next, value: next / 2 ** 32 }
}

function chooseLane(targets, nextId) {
  const upper = targets.filter(target => !target.boss && target.y < 42)
  if (!upper.length) return lanes[(nextId - 1) % lanes.length]
  let bestLane = lanes[(nextId - 1) % lanes.length]
  let bestClearance = -1
  for (let i = 0; i < lanes.length; i++) {
    const candidate = lanes[(nextId - 1 + i) % lanes.length]
    const clearance = Math.min(...upper.map(target => Math.abs(target.lane - candidate)))
    if (clearance > bestClearance) {
      bestClearance = clearance
      bestLane = candidate
    }
  }
  return bestLane
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

function drawWord(state, min, max) {
  const eligible = word => word.length >= min && word.length <= max
  const taken = new Set([...state.targets.map(target => target.word), state.lastWord])
  let { bag, seed } = state
  let index = bag.findIndex(word => eligible(word) && !taken.has(word))
  if (index < 0) {
    ;({ bag, seed } = shuffleWords(GAME_MODES[state.mode].targets, seed))
    index = bag.findIndex(word => eligible(word) && !taken.has(word))
  }
  const word = bag[index]
  return { word, bag: bag.filter((_, i) => i !== index), seed }
}

function chooseSpecialKind(state) {
  if (state.mode === 'letters') return { kind: 'normal', seed: state.seed }
  const settings = PACES[state.pace]
  const roll = nextRandom(state.seed)
  const hasRepair = state.targets.some(t => t.kind === 'repair')
  const hasEmp = state.targets.some(t => t.kind === 'emp')
  if (state.shields < settings.shields && !hasRepair && roll.value < 0.18) {
    return { kind: 'repair', seed: roll.seed }
  }
  if ((state.wave >= 2 || state.elapsed >= 15) && !hasEmp && state.empRemaining <= 0 && roll.value >= 0.18 && roll.value < 0.31) {
    return { kind: 'emp', seed: roll.seed }
  }
  if ((state.wave >= 2 || state.elapsed >= 12) && roll.value >= 0.31 && roll.value < 0.46) {
    return { kind: 'dart', seed: roll.seed }
  }
  return { kind: 'normal', seed: roll.seed }
}

function spawn(state, { y, lane, carrier = false, boss = false, kind, deployed = false } = {}) {
  let resolvedKind = kind ?? (boss ? 'boss' : carrier ? 'carrier' : 'normal')
  let workingState = state
  if (!boss && !carrier && !deployed && !kind) {
    const picked = chooseSpecialKind(state)
    resolvedKind = picked.kind
    workingState = { ...state, seed: picked.seed }
  }
  const [min, max] = workingState.mode === 'letters' ? [1, 1]
    : boss ? [6, 8]
      : carrier ? [workingState.wave >= 10 || workingState.pace === 'challenge' ? 7 : 6, 8]
        : resolvedKind === 'dart' ? [3, 3]
          : [3, workingState.mode === 'endless' && workingState.wave === 1 ? 3 : 4]
  const { word, bag, seed } = drawWord(workingState, min, max)
  const chosenLane = boss ? 50 : (lane ?? chooseLane(workingState.targets, workingState.nextId))
  const hp = boss ? 3 : 1
  const target = {
    ...makeTarget(workingState.nextId, word, y, chosenLane),
    kind: resolvedKind,
    carrier,
    boss,
    hp,
    maxHp: hp,
    scoutsLaunched: 0,
    summonClock: 0,
    laserClock: 0,
  }
  return {
    ...workingState, bag, seed, lastWord: word,
    targets: [...workingState.targets, target], nextId: workingState.nextId + 1,
    remaining: deployed ? workingState.remaining : Math.max(0, workingState.remaining - 1),
    spawnClock: deployed ? workingState.spawnClock : 0,
    carrierSent: workingState.carrierSent || carrier,
  }
}

export function initialGame({ mode = 'words', pace = 'relaxed' } = {}) {
  return {
    phase: 'ready', mode, pace, targets: [], nextId: 1, elapsed: 0, spawnClock: 0,
    score: 0, combo: 0, bestCombo: 0, shots: 0, hits: 0, cleared: 0, shields: PACES[pace].shields,
    lockedId: null, laser: null, feedback: null, lastLetter: null, wave: 1, remaining: 0,
    bag: [], seed: 0, lastWord: null, countdown: 0, audio: null, carrierSent: false,
    effects: [], impactAt: null, playerX: 50, bossLaser: null,
    empRemaining: 0, lastInputAt: 0,
  }
}

function sound(state, ...cues) {
  return { ...state, audio: { id: (state.audio?.id ?? 0) + 1, cues } }
}

function soundWithMeta(state, meta, ...cues) {
  return { ...state, audio: { id: (state.audio?.id ?? 0) + 1, cues, meta } }
}

function beginFlight(state) {
  const boss = state.mode === 'endless' && isMainBossWave(state.wave)
  const carrier = state.mode === 'endless' && isMiniBossWave(state.wave)
  const base = {
    ...state,
    phase: 'playing',
    countdown: 0,
    bossLaser: null,
    lastInputAt: state.elapsed,
    remaining: boss ? 1 : state.remaining,
  }
  const first = spawn(base, { y: boss ? 10 : 18, carrier, boss, kind: boss ? 'boss' : carrier ? 'carrier' : 'normal' })
  return sound(first, 'launch')
}

function acceptLetter(state, letter, fromX = state.playerX ?? 50) {
  if (typeof letter !== 'string' || !/^[A-IK-Y]$/i.test(letter)) return state
  letter = letter.toUpperCase()
  const playerX = state.playerX ?? 50
  const eligible = state.targets.filter(target => target.y >= spawnY && target.y < defenseLine)
  const locked = eligible.find(target => target.id === state.lockedId)
  // Always prioritize the eligible enemy closest to the player whose next needed letter matches.
  const target = eligible
    .filter(ship => ship.word[ship.typed] === letter)
    .sort((a, b) => (b.y - a.y) || (Math.abs(a.x - playerX) - Math.abs(b.x - playerX)) || (a.id - b.id))[0]
  const input = { ...state, lastLetter: letter, shots: state.shots + 1, lastInputAt: state.elapsed }
  if (!target) {
    return {
      ...input, combo: 0,
      feedback: { tone: 'miss', text: locked ? 'Wrong letter' : 'No matching ship', targetId: locked?.id, at: state.elapsed },
    }
  }
  const wordDone = target.typed + 1 === target.word.length
  const remainingHp = wordDone ? (target.hp ?? 1) - 1 : (target.hp ?? 1)
  const destroyed = wordDone && remainingHp <= 0
  const combo = state.combo + Number(wordDone)
  const overdriveBonus = wordDone && combo >= 5 ? 50 : 0
  const points = (destroyed
    ? (target.boss ? 600 : 100) * Math.min(combo, 5)
    : wordDone ? 250 * Math.min(combo, 5) : 25) + overdriveBonus

  const cues = locked ? ['shot'] : ['lock', 'shot']
  if (wordDone) cues.push('clear')

  const settings = PACES[state.pace]
  let shields = state.shields
  let empRemaining = state.empRemaining ?? 0
  let feedback = destroyed
    ? { tone: 'hit', text: target.boss ? 'Mothership destroyed!' : target.word + ' cleared', at: state.elapsed }
    : wordDone && target.boss
      ? { tone: 'hit', text: `Mothership hull ${remainingHp}/${target.maxHp}`, at: state.elapsed }
      : null

  if (destroyed && target.kind === 'repair') {
    if (shields < settings.shields) {
      shields += 1
      feedback = { tone: 'hit', text: 'Shield restored +1!', at: state.elapsed }
    }
    cues.push('powerup')
  } else if (destroyed && target.kind === 'emp') {
    empRemaining = empDuration
    feedback = { tone: 'hit', text: 'EMP active — enemies slowed!', at: state.elapsed }
    cues.push('emp')
  }

  let nextBag = state.bag
  let nextSeed = state.seed
  let nextLastWord = state.lastWord
  let nextTargets
  if (destroyed) {
    nextTargets = state.targets.filter(ship => ship.id !== target.id)
  } else if (wordDone && target.boss) {
    const drawn = drawWord(state, 6, 8)
    nextBag = drawn.bag
    nextSeed = drawn.seed
    nextLastWord = drawn.word
    nextTargets = state.targets.map(ship => ship.id === target.id
      ? { ...ship, word: drawn.word, typed: 0, hp: remainingHp }
      : ship)
  } else {
    nextTargets = state.targets.map(ship => ship.id === target.id ? { ...ship, typed: ship.typed + 1 } : ship)
  }

  let effects = state.effects ?? []
  if (destroyed && target.boss) {
    effects = [
      ...effects,
      { id: `b-${input.shots}-L`, kind: 'burst', x: 24, y: target.y, carrier: true, boss: true, delay: 0, points: null, combo, at: state.elapsed },
      { id: `b-${input.shots}-C`, kind: 'burst', x: 50, y: target.y + 2, carrier: true, boss: true, delay: 140, points, combo, at: state.elapsed },
      { id: `b-${input.shots}-R`, kind: 'burst', x: 76, y: target.y, carrier: true, boss: true, delay: 280, points: null, combo, at: state.elapsed },
    ]
  } else if (wordDone) {
    effects = [
      ...effects,
      {
        id: `b-${input.shots}-${target.id}`,
        kind: 'burst',
        x: target.x,
        y: target.y,
        carrier: Boolean(target.carrier || target.boss),
        special: target.kind === 'repair' ? 'repair' : target.kind === 'emp' ? 'emp' : null,
        points,
        combo,
        at: state.elapsed,
      },
    ]
  }

  return soundWithMeta({
    ...input,
    bag: nextBag,
    seed: nextSeed,
    lastWord: nextLastWord,
    targets: nextTargets,
    shields,
    empRemaining,
    lockedId: wordDone ? null : target.id,
    bossLaser: destroyed && target.boss ? null : state.bossLaser,
    hits: state.hits + 1,
    cleared: state.cleared + Number(destroyed),
    combo,
    bestCombo: Math.max(state.bestCombo, combo),
    score: state.score + points,
    laser: { id: input.shots, fromX, x: target.x, y: target.y, targetId: target.id, overdrive: combo >= 5, at: state.elapsed },
    feedback,
    effects,
  }, { step: target.typed, length: target.word.length, combo, carrier: Boolean(target.carrier || target.boss) }, ...cues)
}

function finish(state, ...cues) {
  return sound({ ...state, phase: 'complete', laser: null, bossLaser: null, empRemaining: 0 }, ...cues, 'end')
}

function advanceFlight(state, incomingPlayerX) {
  const playerX = typeof incomingPlayerX === 'number' && Number.isFinite(incomingPlayerX)
    ? Math.max(12, Math.min(88, incomingPlayerX))
    : (state.playerX ?? 50)
  const settings = PACES[state.pace]
  const dt = tickMs / 1000
  const elapsed = state.elapsed + dt
  const endless = state.mode === 'endless'
  if (!endless && elapsed >= settings.duration) return finish({ ...state, playerX, elapsed: settings.duration })
  const level = endless ? state.wave - 1 : Math.floor(elapsed / 20)
  const empRemaining = Math.max(0, (state.empRemaining ?? 0) - dt)
  const empFactor = empRemaining > 0 ? 0.4 : 1
  const speed = Math.min(4.1, settings.speed + level * .28) * empFactor
  const chaseSpeed = Math.min(9.5, 4.8 + level * .35) * empFactor
  const targets = []
  const breached = []

  for (const target of state.targets) {
    if (target.boss) {
      const y = target.y < bossHoverY ? Math.min(bossHoverY, target.y + 3.2 * dt) : bossHoverY
      targets.push({
        ...target,
        x: 50,
        y,
        summonClock: (target.summonClock ?? 0) + dt,
        laserClock: (target.laserClock ?? 0) + dt,
      })
      continue
    }
    const kindSpeed = target.carrier ? .65 : target.kind === 'dart' ? 1.45 : 1
    const y = target.y + speed * kindSpeed * dt
    if (y >= defenseLine) {
      breached.push(target)
      continue
    }
    const dx = playerX - target.x
    const stepX = Math.sign(dx) * Math.min(Math.abs(dx), chaseSpeed * (target.carrier ? .55 : 1) * dt)
    const x = Math.max(10, Math.min(90, target.x + stepX))
    targets.push({ ...target, x, y })
  }

  let lost = breached.length
  let bossLaser = state.bossLaser
  let bossFeedback = null
  const extraCues = []
  const extraEffects = []
  const boss = targets.find(target => target.boss)

  if (!boss) {
    bossLaser = null
  } else if (bossLaser) {
    const remainingTime = bossLaser.timer - dt
    if (bossLaser.phase === 'warning' && remainingTime <= 0) {
      const beams = bossLaser.beams ?? [bossLaser.beamX]
      const hitPlayer = beams.some(bx => Math.abs(playerX - bx) <= bossBeamHalfWidth)
      bossLaser = { ...bossLaser, phase: 'firing', timer: bossFireDuration, sourceX: boss.x, sourceY: boss.y + 6 }
      extraCues.push('bossLaser')
      if (hitPlayer) {
        lost += 1
        bossFeedback = { tone: 'miss', text: 'Mothership laser hit!', at: elapsed }
        extraEffects.push({ id: `bl-${Math.round(elapsed * 100)}`, kind: 'breach', x: playerX, y: defenseLine, at: elapsed })
      } else {
        bossFeedback = { tone: 'hit', text: 'Laser dodged!', at: elapsed }
      }
    } else if (bossLaser.phase === 'firing' && remainingTime <= 0) {
      bossLaser = null
    } else {
      bossLaser = { ...bossLaser, timer: remainingTime, sourceX: boss.x, sourceY: boss.y + 6 }
    }
  } else if (boss.y >= bossHoverY && boss.laserClock >= (boss.hp === 1 ? 4.5 : state.pace === 'challenge' ? 5.2 : 6.5)) {
    boss.laserClock = 0
    const primaryBeam = Math.max(16, Math.min(84, playerX))
    const beams = boss.hp === 1
      ? [primaryBeam, primaryBeam > 50 ? Math.max(18, primaryBeam - 30) : Math.min(82, primaryBeam + 30)]
      : [primaryBeam]
    bossLaser = {
      id: `laser-${Math.round(elapsed * 100)}`,
      phase: 'warning',
      beamX: primaryBeam,
      beams,
      sourceX: boss.x,
      sourceY: boss.y + 6,
      timer: bossWarningDuration,
    }
    extraCues.push('warn')
    bossFeedback = { tone: 'miss', text: boss.hp === 1 ? 'Twin laser incoming!' : 'Laser incoming!', at: elapsed }
  }

  const activeFeedback = bossFeedback ?? (state.feedback && (state.feedback.at == null || elapsed - state.feedback.at < feedbackLifetime) ? state.feedback : null)
  const activeEffects = [
    ...(state.effects ?? []).filter(effect => elapsed - effect.at < (effect.boss ? 1.05 : 0.75)),
    ...breached.map(ship => ({ id: `i-${ship.id}-${Math.round(elapsed * 100)}`, kind: 'breach', x: ship.x, y: defenseLine, at: elapsed })),
    ...extraEffects,
  ]

  let next = {
    ...state, playerX, targets, elapsed, spawnClock: state.spawnClock + dt,
    shields: Math.max(0, state.shields - lost), combo: lost ? 0 : state.combo,
    lockedId: targets.some(target => target.id === state.lockedId) ? state.lockedId : null,
    laser: state.laser && elapsed - state.laser.at < .4 ? state.laser : null,
    feedback: activeFeedback,
    effects: activeEffects,
    bossLaser,
    empRemaining,
    impactAt: lost ? elapsed : (state.impactAt !== null && elapsed - state.impactAt < 0.45 ? state.impactAt : null),
  }

  if (!next.shields) return finish(next, 'impact')
  if (lost) {
    const impactText = bossFeedback?.tone === 'miss' ? bossFeedback.text : (lost === 1 ? 'Shield hit' : lost + ' shield hits')
    next = sound({ ...next, feedback: { tone: 'miss', text: impactText, at: elapsed } }, ...(extraCues.length ? [...extraCues, 'impact'] : ['impact']))
  } else if (extraCues.length) {
    next = sound(next, ...extraCues)
  }

  if (endless && !targets.length && !next.remaining) {
    const nextWave = state.wave + 1
    return sound({
      ...next,
      phase: 'countdown',
      wave: nextWave,
      remaining: isMainBossWave(nextWave) ? 1 : Math.min(8, nextWave),
      countdown: countdownSeconds,
      laser: null,
      bossLaser: null,
      lastLetter: null,
      feedback: null,
      carrierSent: false,
    }, ...(lost ? ['impact', 'countdown'] : ['countdown']))
  }

  // Mothership periodically summons minion scouts from its hangar bays.
  if (boss && boss.y >= bossHoverY && boss.summonClock >= (state.pace === 'challenge' ? 5.5 : 7) && targets.length < settings.maxTargets) {
    const side = boss.scoutsLaunched % 2 === 0 ? -1 : 1
    next = {
      ...next,
      targets: targets.map(target => target.id === boss.id
        ? { ...target, summonClock: 0, scoutsLaunched: target.scoutsLaunched + 1 }
        : target),
    }
    return spawn(next, { y: boss.y + 8, lane: Math.max(14, Math.min(86, boss.x + side * 26)), deployed: true })
  }

  // Mini-boss carrier deploys up to 2 flank scouts as it descends.
  const carrier = targets.find(target => target.carrier && target.scoutsLaunched < 2 &&
    target.y >= 27 + target.scoutsLaunched * 11)
  if (carrier && targets.length < settings.maxTargets) {
    const side = carrier.scoutsLaunched === 0 ? -1 : 1
    next = {
      ...next,
      targets: targets.map(target => target.id === carrier.id ? { ...target, scoutsLaunched: target.scoutsLaunched + 1 } : target),
    }
    return spawn(next, { y: carrier.y + 3, lane: Math.max(12, Math.min(88, carrier.x + side * 16)), deployed: true })
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
    case 'INPUT': return state.phase === 'playing' ? acceptLetter(state, action.letter, action.fromX) : state
    case 'TICK': {
      if (state.phase === 'playing') return advanceFlight(state, action.playerX)
      if (state.phase !== 'countdown') return state
      const countdown = state.countdown - tickMs / 1000
      if (countdown <= 0) return beginFlight(state)
      const next = { ...state, countdown }
      return Number.isInteger(countdown) ? sound(next, 'countdown') : next
    }
    default: return state
  }
}

export const SHIP_SKINS = [
  { id: 'classic', name: 'Classic Blue', minScore: 0, requirement: 'Unlocked' },
  { id: 'emerald', name: 'Emerald Wing', minScore: 2000, requirement: '2,000+ pts' },
  { id: 'gold', name: 'Gold Ace', minScore: 5000, requirement: '5,000+ pts' },
  { id: 'crimson', name: 'Crimson Striker', minScore: 10000, requirement: '10,000+ pts' },
  { id: 'nova', name: 'Nova Sovereign', minScore: 20000, bossUnlock: true, requirement: 'Beat Mothership or 20,000 pts' },
]

export function readHighestArcadeScore() {
  let highest = 0
  for (const mode of Object.keys(GAME_MODES)) {
    for (const pace of Object.keys(PACES)) {
      for (const input of ['camera', 'keyboard']) {
        highest = Math.max(highest, readArcadeBest(mode, pace, input))
      }
    }
  }
  return highest
}

export function readMothershipDefeated() {
  try { return localStorage.getItem('asignx-arcade-boss-defeated') === 'true' } catch { return false }
}

export function unlockedShipSkins(highestScore = readHighestArcadeScore(), bossDefeated = readMothershipDefeated()) {
  return SHIP_SKINS.filter(skin =>
    skin.minScore === 0
    || highestScore >= skin.minScore
    || (skin.bossUnlock && bossDefeated),
  ).map(skin => skin.id)
}

export function readSelectedShipSkin(unlocked = unlockedShipSkins()) {
  try {
    const saved = localStorage.getItem('asignx-arcade-skin')
    return saved && unlocked.includes(saved) ? saved : 'classic'
  } catch {
    return 'classic'
  }
}

export function readFeaturedShipSkins(unlocked = unlockedShipSkins()) {
  try {
    const raw = JSON.parse(localStorage.getItem('asignx-arcade-hall-ships') || '[]')
    if (Array.isArray(raw)) {
      const valid = [...new Set(raw)].filter(id => unlocked.includes(id)).slice(0, 5)
      if (valid.length) return valid
    }
  } catch { /* Storage is optional. */ }
  return unlocked.slice(0, 5)
}

export function saveFeaturedShipSkins(ids, unlocked = unlockedShipSkins()) {
  const valid = [...new Set(Array.isArray(ids) ? ids : [])].filter(id => unlocked.includes(id)).slice(0, 5)
  try { localStorage.setItem('asignx-arcade-hall-ships', JSON.stringify(valid)) } catch { /* Storage is optional. */ }
  return valid
}

export function arcadeAccuracy(state) {
  return state.shots ? Math.round((state.hits / state.shots) * 100) : 0
}
export function arcadeBestKey(mode, pace, input) {
  return input === 'keyboard' ? `asignx-arcade-best-${mode}-${pace}` : `asignx-arcade-best-${mode}-${pace}-camera`
}
export function readArcadeBest(mode, pace, input) {
  try { const n = Number(localStorage.getItem(arcadeBestKey(mode, pace, input))); return Number.isFinite(n) && n > 0 ? n : 0 } catch { return 0 }
}
