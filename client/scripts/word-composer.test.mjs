import assert from 'node:assert/strict'
import { initialWordState, wordComposer } from '../src/recognition/wordComposer.js'
import { createLatestSuggestions } from '../src/recognition/nlp/latestSuggestions.js'

const add = (state, text) => wordComposer(state, { type: 'letters', letters: [...text].map(label => ({ label })) })
let state = add(initialWordState, 'HELO')
assert.equal(state.pending, 'HELO')
assert.deepEqual(state.accepted, [], 'Recognition never auto-accepts a suggestion')
const staleRevision = state.revision
state = add(state, 'S')
assert.equal(wordComposer(state, { type: 'finish', text: 'HELLO', revision: staleRevision }), state, 'A late suggestion cannot consume new letters')
state = wordComposer(state, { type: 'clear' })
state = add(state, 'HELO')
state = wordComposer(state, { type: 'finish', text: 'HELLO', revision: state.revision })
assert.deepEqual(state.accepted, [{ text: 'HELLO', detected: 'HELO' }], 'Accepted corrections preserve their detected spelling')
assert.equal(state.pending, '')
state = add(state, 'WORLD')
state = wordComposer(state, { type: 'finish', revision: state.revision })
assert.equal(state.accepted.map(item => item.text).join(' '), 'HELLO WORLD', 'Explicit word boundaries add spaces')
state = add(state, 'TT')
assert.equal(state.pending, 'TT', 'Confirmed double letters remain distinct')
state = wordComposer(state, { type: 'finish', revision: state.revision })
assert.equal(state.accepted.at(-1).text, 'TT', 'Finish word can keep names and unknown spellings')
const revision = state.revision
state = wordComposer(state, { type: 'clear' })
assert.equal(state.pending, ''); assert.deepEqual(state.accepted, [])
assert.ok(state.revision > revision, 'Clearing invalidates all old suggestions')
state = add(state, 'A'.repeat(201))
assert.equal(state.pending.length, 200); assert.equal(state.full, true)
assert.deepEqual(state.accepted, [], 'A full input never silently creates a word boundary')

const sent = [], responses = []
const worker = { postMessage: data => sent.push(data), terminate: () => { worker.stopped = true } }
const requests = createLatestSuggestions(worker, data => responses.push(data))
requests.update('H', 1); requests.update('HE', 2); requests.update('HEL', 3)
assert.equal(sent.length, 1, 'One worker request at a time')
worker.onmessage({ data: { id: 1, result: 'old' } })
assert.deepEqual(responses, [], 'Stale responses never update suggestions')
assert.equal(sent.at(-1).text, 'HEL', 'Only the newest pending spelling is processed')
assert.equal(sent.at(-1).mode, 'word')
worker.onmessage({ data: { id: 3, result: 'current' } })
assert.equal(responses.at(-1).result, 'current')
requests.update('HELLO', 4); requests.update('', 5)
worker.onmessage({ data: { id: 4, result: 'after finish' } })
assert.equal(responses.length, 1, 'Finishing or clearing discards in-flight suggestions')
requests.update('W', 6); requests.stop()
worker.onmessage({ data: { id: 6, result: 'after unmount' } })
assert.equal(responses.length, 1); assert.ok(worker.stopped)
console.log('PASS explicit word acceptance, raw spelling, double letters, limits and latest-only worker lifecycle')
