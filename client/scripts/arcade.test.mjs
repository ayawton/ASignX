import assert from 'node:assert/strict'
import { defenseLine, GAME_MODES, gameReducer, initialGame, makeTarget } from '../src/data/arcade.js'
import { createRecognitionEngine } from '../src/recognition/recognitionEngine.js'

const start = () => gameReducer(initialGame(), { type: 'START' })
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

const entering = { ...start(), targets: [makeTarget(1, 'words', 2), makeTarget(2, 'words', 22)] }
assert.equal(sign(entering, 'S').lockedId, 2, 'A partially entered ship cannot lock')
assert.equal(sign({ ...entering, targets: [makeTarget(1, 'words', defenseLine)] }, 'S').lockedId, null)
assert.equal(sign({ ...entering, targets: [] }, 'S').lockedId, null)

const paused = gameReducer(sign(start(), 'S'), { type: 'PAUSE' })
assert.equal(sign(paused, 'T'), paused)
assert.equal(gameReducer(paused, { type: 'TICK' }), paused)
const approaching = { ...start(), lockedId: 1, targets: [{ ...makeTarget(1, 'words', defenseLine - .1), typed: 1 }] }
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

for (let id = 1; id <= GAME_MODES.words.targets.length * 2; id++) {
  assert.match(makeTarget(id, 'words').word, /^[A-IK-Y]+$/)
}
console.log('PASS Word Defense targeting, entry and impact, repeated letters, pause and spawn vocabulary')
