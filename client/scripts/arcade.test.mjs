import assert from 'node:assert/strict'
import { arcadeAccuracy, defenseLine, GAME_MODES, gameReducer, initialGame, makeTarget, unlockedShipSkins } from '../src/data/arcade.js'
import { createRecognitionEngine } from '../src/recognition/recognitionEngine.js'

const tick = game => gameReducer(game, { type: 'TICK' })
function launch(game = initialGame(), seed = 42) {
  game = gameReducer(game, { type: 'START', seed })
  assert.equal(game.phase, 'countdown')
  while (game.phase === 'countdown') game = tick(game)
  return game
}
const start = () => ({ ...launch(), targets: [
  makeTarget(1, 'STAR', 38), makeTarget(2, 'SUN', 22), makeTarget(3, 'HELLO', 17),
], nextId: 4 })
const sign = (game, letter) => gameReducer(game, { type: 'INPUT', letter })

let game = start()
game = sign(game, 'S')
assert.equal(game.lockedId, 1, 'STAR is closer than SUN')
assert.equal(game.targets.find(target => target.id === 1).typed, 1)
game = sign(game, 'U')
assert.equal(game.lockedId, 1, 'A wrong letter preserves the lock')
assert.equal(game.feedback.targetId, 1, 'Only the locked ship receives wrong-letter feedback')
assert.equal(sign(start(), 'X').feedback.targetId, undefined, 'An unmatched letter has no ship to flash')
assert.equal(game.targets.find(target => target.id === 1).typed, 1)
for (const letter of 'TAR') game = sign(game, letter)
assert.equal(game.lockedId, null)
assert.deepEqual(game.targets.map(target => target.word), ['SUN', 'HELLO'])
assert.equal(game.cleared, 1)
assert.equal(game.score, 175)

const entering = { ...start(), targets: [makeTarget(1, 'STAR'), makeTarget(2, 'SUN', 22)] }
assert.equal(sign(entering, 'S').lockedId, 2, 'The closer visible ship wins')
assert.equal(sign({ ...entering, targets: entering.targets.slice(0, 1) }, 'S').lockedId, 1, 'An entering ship can lock')
assert.equal(sign({ ...entering, targets: [makeTarget(1, 'STAR', -12)] }, 'S').lockedId, null)
assert.equal(sign({ ...entering, targets: [makeTarget(1, 'STAR', defenseLine)] }, 'S').lockedId, null)
assert.equal(sign({ ...entering, targets: [] }, 'S').lockedId, null)

const paused = gameReducer(sign(start(), 'S'), { type: 'PAUSE' })
assert.equal(sign(paused, 'T'), paused)
assert.equal(gameReducer(paused, { type: 'TICK' }), paused)
const approaching = { ...start(), lockedId: 1, targets: [{ ...makeTarget(1, 'STAR', defenseLine - .1), typed: 1 }] }
const impact = gameReducer(approaching, { type: 'TICK' })
assert.equal(impact.lockedId, null)
assert.equal(impact.shields, approaching.shields - 1)
assert.ok(!impact.targets.some(target => target.id === 1))

game = start()
for (const letter of 'HELLO') game = sign(game, letter)
assert.equal(game.cleared, 1, 'Repeated letters count as distinct inputs')
const engine = createRecognitionEngine(async () => ['L', .99], null, 15)
const hand = Array.from({ length: 21 }, (_, index) => [index / 100, index / 100, 0])
let time = 0
async function holdSign() {
  const letters = []
  for (let frame = 0; frame < 12; frame++) {
    const result = await engine.process({ Left: hand }, time += 70)
    letters.push(...result.emissions.map(item => item.label))
  }
  return letters
}
assert.deepEqual(await holdSign(), ['L'], 'A held sign produces one input')
for (let frame = 0; frame < 5; frame++) await engine.process({}, time += 70)
assert.deepEqual(await holdSign(), ['L'], 'Releasing and signing again produces a second input')

assert.ok(GAME_MODES.words.targets.length > 80)
assert.equal(new Set(GAME_MODES.words.targets).size, GAME_MODES.words.targets.length)
assert.ok(GAME_MODES.words.targets.every(word => /^[A-IK-Y]+$/.test(word)))
assert.notDeepEqual(launch(initialGame(), 42).bag, launch(initialGame(), 43).bag)

function clearShips(game) {
  for (const ship of game.targets) for (const letter of ship.word) game = sign(game, letter)
  return game
}
let endless = launch(initialGame({ mode: 'endless' }))
const first = endless.targets[0]
const firstStep = tick(endless).targets[0].y - first.y
assert.equal(endless.targets.length, 1)
assert.equal(first.word.length, 3)
const seen = new Set()
for (let frame = 0; frame < 2800 && endless.wave < 12; frame++) {
  if (endless.phase === 'playing' && endless.targets.length) {
    for (const ship of endless.targets) {
      assert.ok(!seen.has(ship.word), 'Words do not repeat while eligible words remain')
      seen.add(ship.word)
    }
    if (endless.wave === 2) {
      assert.ok(tick(endless).targets[0].y - endless.targets[0].y > firstStep)
    }
    endless = clearShips(endless)
  }
  endless = tick(endless)
}
assert.equal(endless.wave, 12)
assert.ok([...seen].some(word => word.length >= 6))

const carrierWave = tick({
  ...initialGame({ mode: 'endless' }), phase: 'countdown', countdown: .25, wave: 5, remaining: 1,
})
const carrier = carrierWave.targets[0]
assert.ok(carrier.carrier)
assert.match(carrier.word, /^[A-IK-Y]{6,8}$/)
let deployment = carrierWave
for (let frame = 0; frame < 200 && deployment.targets.length < 3; frame++) deployment = tick(deployment)
assert.equal(deployment.targets.length, 3)
assert.equal(deployment.targets[0].scoutsLaunched, 2)
for (const scout of deployment.targets.slice(1)) {
  assert.equal(scout.carrier, false)
  assert.match(scout.word, /^[A-IK-Y]{3,4}$/)
}
assert.notEqual(deployment.targets[1].word, deployment.targets[2].word)
const clearedCarrier = tick(clearShips(carrierWave))
assert.equal(clearedCarrier.wave, 6)
assert.equal(clearedCarrier.targets.length, 0, 'A destroyed carrier cannot deploy further scouts')
const timedCarrier = tick({ ...launch(), elapsed: 20, targets: [] })
assert.ok(timedCarrier.targets[0].carrier)

assert.equal(tick({ ...launch(initialGame({ mode: 'endless' })), elapsed: 60 }).phase, 'playing')
assert.equal(tick({ ...launch(), elapsed: 59.75 }).phase, 'complete')
const finalImpact = tick({ ...endless, phase: 'playing', shields: 1, targets: [makeTarget(1, 'STAR', defenseLine - .1)] })
assert.equal(finalImpact.phase, 'complete')
assert.deepEqual(finalImpact.audio.cues, ['impact', 'end'])

assert.equal(arcadeAccuracy({ shots: 0, hits: 0 }), 0)
assert.equal(arcadeAccuracy({ shots: 10, hits: 8 }), 80)

let expiring = sign(start(), 'X')
assert.ok(expiring.feedback)
for (let i = 0; i < 8; i++) expiring = tick(expiring)
assert.equal(expiring.feedback, null, 'Feedback auto-clears after its lifetime')

const lowLeft = makeTarget(1, 'STAR', defenseLine - 5, 22)
const lowRight = makeTarget(2, 'SUN', defenseLine - 5, 78)
assert.ok(lowRight.x - lowLeft.x > 25, 'Approaching ships keep readable horizontal separation')

// Enemies chase the player's horizontal position instead of always heading to center
const chaserStart = { ...launch(), targets: [makeTarget(1, 'STAR', 20, 22)] }
const chasedRight = gameReducer(chaserStart, { type: 'TICK', playerX: 80 })
const chasedLeft = gameReducer(chaserStart, { type: 'TICK', playerX: 15 })
assert.ok(chasedRight.targets[0].x > chaserStart.targets[0].x, 'Enemy chases player to the right')
assert.ok(chasedLeft.targets[0].x < chaserStart.targets[0].x, 'Enemy chases player to the left')

// Wave 15 spawns a mini-boss carrier; Wave 10 spawns a Mothership main boss
const miniBoss15 = tick({ ...initialGame({ mode: 'endless' }), phase: 'countdown', countdown: .25, wave: 15, remaining: 1 })
assert.ok(miniBoss15.targets[0].carrier && !miniBoss15.targets[0].boss, 'Wave 15 spawns a mini-boss carrier')

let bossWave = tick({ ...initialGame({ mode: 'endless' }), phase: 'countdown', countdown: .25, wave: 10, remaining: 1 })
assert.ok(bossWave.targets[0].boss && bossWave.targets[0].hp === 3, 'Wave 10 spawns a 3-HP Mothership')

// Mothership telegraphs a laser warning, fires, and can be dodged or hit
let warned = bossWave
for (let i = 0; i < 60 && !warned.bossLaser; i++) warned = gameReducer(warned, { type: 'TICK', playerX: 50 })
assert.equal(warned.bossLaser?.phase, 'warning', 'Mothership telegraphs its laser before firing')
assert.equal(warned.bossLaser.beamX, 50)

let dodged = warned
for (let i = 0; i < 15 && dodged.bossLaser?.phase === 'warning'; i++) dodged = gameReducer(dodged, { type: 'TICK', playerX: 80 })
assert.equal(dodged.bossLaser?.phase, 'firing')
assert.equal(dodged.shields, warned.shields, 'Moving out of the laser beam avoids damage')

let hitByLaser = warned
for (let i = 0; i < 15 && hitByLaser.bossLaser?.phase === 'warning'; i++) hitByLaser = gameReducer(hitByLaser, { type: 'TICK', playerX: 50 })
assert.equal(hitByLaser.bossLaser?.phase, 'firing')
assert.equal(hitByLaser.shields, warned.shields - 1, 'Staying inside the laser beam damages shields')

// Closest matching enemy gets priority even when another ship is partially typed/locked
const priorityState = {
  ...launch(),
  lockedId: 3,
  targets: [
    makeTarget(1, 'CAT', 55, 30),
    makeTarget(2, 'DOG', 42, 65),
    { ...makeTarget(3, 'TOMCAT', 20, 50), typed: 3 },
  ],
  nextId: 4,
}
const afterC = sign(priorityState, 'C')
assert.equal(afterC.lockedId, 1, 'Closest leading enemy CAT takes priority over further TOMCAT on C')
assert.equal(afterC.targets.find(t => t.id === 1).typed, 1)
assert.equal(afterC.targets.find(t => t.id === 3).typed, 3, 'TOMCAT keeps its partial progress')
const afterD = sign(afterC, 'D')
assert.equal(afterD.lockedId, 2, 'Player can switch to DOG with D without being trapped on one target')
assert.equal(afterD.targets.find(t => t.id === 2).typed, 1)

// Mothership stays stationary at center X=50 once hovered
let hoveredBoss = bossWave
for (let i = 0; i < 20; i++) hoveredBoss = gameReducer(hoveredBoss, { type: 'TICK', playerX: 80 })
assert.equal(hoveredBoss.targets.find(t => t.boss).x, 50, 'Mothership stays stationary at center')

// Power-up ships: Shield Repair restores +1 shield, EMP slows enemies
const damagedWithRepair = { ...start(), shields: 3, targets: [{ ...makeTarget(1, 'CAT', 30, 50), kind: 'repair' }] }
let afterRepair = damagedWithRepair
for (const l of 'CAT') afterRepair = sign(afterRepair, l)
assert.equal(afterRepair.shields, 4, 'Clearing a Shield Repair ship restores +1 shield')

const empState = { ...start(), targets: [{ ...makeTarget(1, 'DOG', 30, 50), kind: 'emp' }, makeTarget(2, 'STAR', 20, 30)] }
let afterEmp = empState
for (const l of 'DOG') afterEmp = sign(afterEmp, l)
assert.equal(afterEmp.empRemaining, 5, 'Clearing an EMP ship activates 5s slow-mo')
const normalStep = tick({ ...start(), targets: [makeTarget(2, 'STAR', 20, 30)] }).targets[0].y - 20
const slowedStep = tick(afterEmp).targets[0].y - 20
assert.ok(slowedStep < normalStep * 0.5, 'EMP slows incoming enemies')

// Enraged Mothership (HP 1) fires twin laser beams
let enragedBoss = {
  ...hoveredBoss,
  bossLaser: null,
  targets: hoveredBoss.targets.map(t => t.boss ? { ...t, hp: 1, laserClock: 10 } : t),
}
enragedBoss = gameReducer(enragedBoss, { type: 'TICK', playerX: 50 })
assert.equal(enragedBoss.bossLaser?.beams?.length, 2, 'Enraged Mothership fires twin laser beams')

// Ship skin unlock milestones
assert.deepEqual(unlockedShipSkins(0, false), ['classic'])
assert.deepEqual(unlockedShipSkins(2500, false), ['classic', 'emerald'])
assert.deepEqual(unlockedShipSkins(10500, false), ['classic', 'emerald', 'gold', 'crimson'])
assert.deepEqual(unlockedShipSkins(0, true), ['classic', 'nova'])

console.log('PASS Arcade targeting, repeated letters, shuffled vocabulary, chasing, mini-bosses, Mothership, power-ups, and ship skins')
