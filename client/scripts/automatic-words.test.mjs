import assert from 'node:assert/strict'
import { createAutomaticWords } from '../src/recognition/nlp/automaticWords.js'
import { wordComposer, initialWordState } from '../src/recognition/wordComposer.js'
import { canFinishSentence } from '../src/recognition/nlp/sentences.js'

const timers = [], finished = []
const ready = { active: true, status: 'ready', hands: [], pendingText: '' }
assert.equal(canFinishSentence({ ...ready, hands: [{ handedness: 'Left' }] }), false, 'A held sign never starts the sentence-end timer')
assert.equal(canFinishSentence({ ...ready, pendingText: 'HEL' }), false, 'Unprocessed letters keep the sentence open')
assert.equal(canFinishSentence({ ...ready, status: 'waiting' }), false, 'Server backpressure is not a sentence boundary')
assert.equal(canFinishSentence({ ...ready, status: 'error' }), false, 'A server failure is not evidence of hand removal')
assert.equal(canFinishSentence(ready), true, 'Observed hands-away time can finish a sentence')
assert.equal(canFinishSentence({ ...ready, active: false, status: 'off' }), true, 'Stopping the camera can finish pending sentence text')
const automatic = createAutomaticWords({ onFinish: (text, id) => finished.push({ text, id }), schedule: (fn, delay) => { const timer = { fn, delay }; timers.push(timer); return timer }, cancel: timer => { if (timer) timer.cancelled = true } })
const response = (id, text) => ({ id, result: { suggestions: [{ text, uncertain: false }] } })
automatic.update('HXLLO', 1)
automatic.receive(response(1, 'HELLO'))
assert.equal(finished.length, 0, 'No automatic word before the pause')
assert.equal(timers.at(-1).delay, 2000)
timers.at(-1).fn()
assert.deepEqual(finished[0], { text: 'HELLO', id: 1 })
automatic.receive(response(1, 'HELLO')); assert.equal(finished.length, 1, 'One word per boundary')
automatic.update('HE', 2); automatic.update('HELO', 3)
assert.ok(timers.at(-2).cancelled, 'New letters restart the word pause')
timers.at(-1).fn(); assert.equal(finished.length, 1, 'A pause waits for the matching backend result')
automatic.receive(response(2, 'HE')); assert.equal(finished.length, 1)
automatic.receive(response(3, 'HELP')); assert.equal(finished.at(-1).text, 'HELP')
automatic.update('QZXQ', 4); automatic.receive({ id: 4, result: { suggestions: [] } }); timers.at(-1).fn()
assert.equal(finished.at(-1).text, 'QZXQ', 'Unknown text survives unchanged')
automatic.update('BOOK', 5); automatic.update('', 6); automatic.receive(response(5, 'BOOK'))
assert.equal(finished.length, 3, 'Clearing discards the pending automatic word')
automatic.update('LETTER', 7); automatic.fail(); timers.at(-1).fn()
assert.equal(finished.at(-1).text, 'LETTER', 'Worker failure falls back to detected text')
automatic.update('BYE', 8); automatic.stop(); timers.at(-1).fn()
assert.equal(finished.length, 4, 'Unmount cancels pending completion')

let state = wordComposer(initialWordState, { type: 'letters', letters: [...'HXLLO'].map(label => ({ label })) })
state = wordComposer(state, { type: 'finish', revision: state.revision, text: 'HELLO' })
state = wordComposer(state, { type: 'letters', letters: [...'WORLD'].map(label => ({ label })) })
state = wordComposer(state, { type: 'finish', revision: state.revision, text: 'WORLD' })
assert.equal(state.sentenceWords.map(item => item.text).join(' '), 'HELLO WORLD')
const before = state.revision
assert.equal(wordComposer(state, { type: 'sentence', revision: before - 1 }), state, 'Stale sentence boundaries are ignored')
state = wordComposer(state, { type: 'sentence', revision: before })
assert.deepEqual(state.sentences, [{ text: 'Hello world.', detected: 'HXLLO WORLD' }])
assert.deepEqual(state.sentenceWords, [])
state = wordComposer(state, { type: 'letters', letters: [{ label: 'I' }] })
assert.equal(wordComposer(state, { type: 'sentence', revision: state.revision }), state, 'A sentence cannot finish while a word is being spelled')
state = wordComposer(state, { type: 'finish', revision: state.revision, text: 'I' })
state = wordComposer(state, { type: 'letters', letters: [...'AM'].map(label => ({ label })) })
state = wordComposer(state, { type: 'finish', revision: state.revision, text: 'AM' })
state = wordComposer(state, { type: 'sentence', revision: state.revision })
assert.equal(state.sentences.at(-1).text, 'I am.')
state = wordComposer(state, { type: 'clear' })
assert.deepEqual(state.sentences, []); assert.deepEqual(state.accepted, [])
for (const fragment of ['HE', 'L', 'LO', 'THERE']) {
 state = wordComposer(state, { type: 'letters', letters: [...fragment].map(label => ({ label })) })
 state = wordComposer(state, { type: 'finish', revision: state.revision, text: fragment })
}
state = wordComposer(state, { type: 'sentence', revision: state.revision, text: 'HELLO THERE' })
assert.deepEqual(state.sentences[0], { text: 'Hello there.', detected: 'HE L LO THERE' }, 'The sentence layer can revise provisional pause boundaries')

// Reproduce slow fingerspelling: HEL, a long held-sign pause, then LO.
let now = 0, handVisible = true, slowState = initialWordState
const scheduled = []
const schedule = (fn, delay) => { const item = { fn, due: now + delay }; scheduled.push(item); return item }
const cancel = item => { if (item) item.cancelled = true }
function advance(milliseconds) {
 const target = now + milliseconds
 while (true) {
  scheduled.sort((a, b) => a.due - b.due)
  const index = scheduled.findIndex(item => !item.cancelled && item.due <= target)
  if (index === -1) break
  const [item] = scheduled.splice(index, 1); now = item.due; item.fn()
 }
 now = target
}
const sentenceBoundary = createAutomaticWords({ schedule, cancel, pauseMs: 4000, onFinish: (text, revision) => {
 slowState = wordComposer(slowState, { type: 'sentence', text, revision })
} })
function syncSentence() {
 const raw = slowState.sentenceWords.map(item => item.detected).join(' ')
 const fallback = slowState.sentenceWords.map(item => item.text).join(' ')
 const canFinish = canFinishSentence({ active: true, status: 'ready', hands: handVisible ? [{}] : [], pendingText: slowState.pending })
 sentenceBoundary.update(canFinish ? raw : '', slowState.revision, fallback)
 sentenceBoundary.receive(response(slowState.revision, raw === 'HEL LO' ? 'HELLO' : fallback))
}
const wordBoundary = createAutomaticWords({ schedule, cancel, onFinish: (text, revision) => {
 slowState = wordComposer(slowState, { type: 'finish', text, revision }); syncSentence()
} })
function spell(text) {
 slowState = wordComposer(slowState, { type: 'letters', letters: [...text].map(label => ({ label })) })
 syncSentence()
 wordBoundary.update(slowState.pending, slowState.revision)
 wordBoundary.receive(response(slowState.revision, slowState.pending))
}
spell('HEL'); advance(10000)
assert.deepEqual(slowState.sentences, [], 'A long held sign must not finalize Hel.')
spell('LO'); advance(10000)
assert.deepEqual(slowState.sentences, [], 'The continuation stays in the same sentence while the hand is visible')
handVisible = false; syncSentence(); advance(3999)
assert.deepEqual(slowState.sentences, [])
advance(1)
assert.deepEqual(slowState.sentences, [{ text: 'Hello.', detected: 'HEL LO' }], 'Hands-away completion produces Hello., not Hel. Lo.')
wordBoundary.stop(); sentenceBoundary.stop()
console.log('PASS automatic word timing, async ordering, fallback and second-tier sentence assembly')
