import assert from 'node:assert/strict'
import { defenseLine, GAME_MODES, gameReducer, initialGame, makeTarget } from '../src/data/arcade.js'
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
assert.equal(tick({ ...launch(initialGame({ mode: 'endless' })), elapsed: 60 }).phase, 'playing')
assert.equal(tick({ ...launch(), elapsed: 59.75 }).phase, 'complete')
const finalImpact = tick({ ...endless, phase: 'playing', shields: 1, targets: [makeTarget(1, 'STAR', defenseLine - .1)] })
assert.equal(finalImpact.phase, 'complete')
assert.deepEqual(finalImpact.audio.cues, ['impact', 'end'])

console.log('PASS Arcade targeting, repeated letters, shuffled vocabulary, and Endless progression')
