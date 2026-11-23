import assert from 'node:assert/strict'
import { initialWordState, shouldAcceptWholeSign, WHOLE_SIGN_LETTER_COOLDOWN_MS, WHOLE_SIGN_MID_WORD_MIN_CONFIDENCE, wordComposer } from '../src/recognition/wordComposer.js'
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

let mixed = add(initialWordState, 'XIAN')
mixed = wordComposer(mixed, { type: 'sign', label: 'THANK YOU' })
assert.equal(mixed.pending, '')
assert.deepEqual(mixed.sentenceWords.map(word => word.text), ['XIAN', 'THANK YOU'])
assert.equal(mixed.sentenceWords.at(-1).wholeSign, true)
mixed = wordComposer(mixed, { type: 'sentence', revision: mixed.revision })
assert.equal(mixed.sentences.at(-1).text, 'Xian thank you.')

// Part 1: Gating whole-sign interruptions during active fingerspelling
let spelling = wordComposer(initialWordState, { type: 'letters', letters: [{ label: 'S' }, { label: 'U' }, { label: 'M' }], at: 1000 })
// 1) Within cooldown after letter (including hand-lower/raise for double M) is blocked even at high confidence
assert.equal(shouldAcceptWholeSign({ pending: spelling.pending, lastLetterAt: spelling.lastLetterAt, confidence: 0.99, at: 2100 }), false)
spelling = wordComposer(spelling, { type: 'sign', label: 'THANK YOU', confidence: 0.99, at: 1000 + WHOLE_SIGN_LETTER_COOLDOWN_MS - 1 })
assert.equal(spelling.pending, 'SUM', 'Whole sign within letter cooldown must not split pending fingerspelling')
assert.equal(spelling.sentenceWords.length, 0)
// 2) After cooldown, borderline confidence (< 0.97) is still blocked mid-word
spelling = wordComposer(spelling, { type: 'sign', label: 'THANK YOU', confidence: WHOLE_SIGN_MID_WORD_MIN_CONFIDENCE - 0.01, at: 1000 + WHOLE_SIGN_LETTER_COOLDOWN_MS + 100 })
assert.equal(spelling.pending, 'SUM', 'Borderline whole sign mid-word must not interrupt spelling')
// 3) Remaining letters complete SUMMER intact
spelling = wordComposer(spelling, { type: 'letters', letters: [{ label: 'M' }, { label: 'E' }, { label: 'R' }], at: 3000 })
assert.equal(spelling.pending, 'SUMMER')
// 4) Intentional high-confidence whole sign after cooldown flushes pending and stores confidence
spelling = wordComposer(spelling, { type: 'sign', label: 'THANK YOU', confidence: 0.98, at: 3000 + WHOLE_SIGN_LETTER_COOLDOWN_MS })
assert.equal(spelling.pending, '')
assert.deepEqual(spelling.sentenceWords, [
 { text: 'SUMMER', detected: 'SUMMER' },
 { text: 'THANK YOU', detected: 'THANK YOU', wholeSign: true, confidence: 0.98 },
])
// 5) When no fingerspelling is pending, standard-confidence whole signs are accepted immediately
const idleSign = wordComposer(initialWordState, { type: 'sign', label: 'HELLO', confidence: 0.82, at: 500 })
assert.deepEqual(idleSign.sentenceWords, [{ text: 'HELLO', detected: 'HELLO', wholeSign: true, confidence: 0.82 }])

// Per-letter signals (confidence, alternatives, hand: 'Motion') flow into pendingLetters and committed groups
let sigState = wordComposer(initialWordState, {
 type: 'letters',
 letters: [
  { label: 'Z', confidence: 0.74, hand: 'Motion' },
  { label: 'O', confidence: 0.96, alternatives: [{ label: 'Q', confidence: 0.03 }], hand: 'Right' },
 ],
 at: 1000,
})
assert.deepEqual(sigState.pendingLetters, [
 { label: 'Z', confidence: 0.74, fromMotion: true },
 { label: 'O', confidence: 0.96, alternatives: [{ label: 'Q', confidence: 0.03 }] },
])
sigState = wordComposer(sigState, { type: 'finish', text: 'ZO', revision: sigState.revision })
assert.equal(sigState.pendingLetters.length, 0)
assert.deepEqual(sigState.accepted.at(-1).letters, [
 { label: 'Z', confidence: 0.74, fromMotion: true },
 { label: 'O', confidence: 0.96, alternatives: [{ label: 'Q', confidence: 0.03 }] },
])

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
