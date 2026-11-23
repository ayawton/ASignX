import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { createFrameStream } from '../src/recognition/frameStream.js'
import { bodyFeatures, bodyFrameVisible, bodySequence } from '../src/recognition/bodyFeatures.js'
import { createRecognitionEngine } from '../src/recognition/recognitionEngine.js'

const id = 'a'.repeat(43)
const empty = { hands: [], readings: [], emissions: [], dynamic: null, moving: false }
function setup(override = {}) {
 const calls = [], states = [], results = [], queue = []
 let timestamp = 1000
 const video = { readyState: 4, paused: false, currentTime: 1, videoWidth: 1920, videoHeight: 1080 }
 const canvas = { getContext: () => ({ drawImage: target => assert.equal(target, video) }), toBlob: done => done(new Blob(['jpeg'], { type: 'image/jpeg' })) }
 const fetcher = async (url, options) => {
  calls.push({ url, options })
  if (override.fetcher) return override.fetcher(url, options)
  return Response.json(url.endsWith('/sessions') ? { session_id: id } : empty)
 }
 const stream = createFrameStream(video, { onState: (...args) => states.push(args), onResult: data => results.push(data), fetcher, canvasFactory: () => canvas, schedule: (fn, delay) => { const item = { fn, delay }; queue.push(item); return item }, cancel: item => { if (item) item.cancelled = true }, clock: () => timestamp += 100, visible: () => true })
 return { calls, states, results, video, canvas, queue, stream }
}
const test = setup()
await test.stream.start()
assert.equal(test.states.at(-1)[0], 'ready')
await test.queue.shift().fn()
assert.equal(test.results.length, 1)
assert.equal(test.canvas.width, 640); assert.equal(test.canvas.height, 360)
const request = test.calls.find(call => call.url.endsWith('/frames'))
assert.equal(request.options.headers['Content-Type'], 'image/jpeg')
assert.ok(request.options.body instanceof Blob, 'Only JPEG frames are uploaded')
assert.ok(!('Authorization' in request.options.headers), 'Internal service credentials never reach the browser')
test.stream.clear(); test.video.currentTime++
await test.queue.shift().fn()
assert.ok(test.calls.some(call => call.url.endsWith('/reset')))
test.stream.stop()
assert.equal(test.calls.at(-1).options.method, 'DELETE')
assert.ok(test.queue.at(-1).cancelled)
console.log('PASS JPEG resizing, session creation, reset, cleanup and same-origin transport')

let completeFrame
const pending = setup({ fetcher: async url => url.endsWith('/frames') ? new Promise(resolve => { completeFrame = resolve }) : Response.json({ session_id: id }) })
await pending.stream.start()
const inFlight = pending.queue.shift().fn()
for (let i = 0; i < 10 && !completeFrame; i++) await Promise.resolve()
assert.equal(pending.queue.length, 1, 'Capture continues while inference is in flight')
pending.video.currentTime++; await pending.queue.shift().fn()
pending.video.currentTime++; await pending.queue.shift().fn()
assert.equal(pending.calls.filter(call => call.url.endsWith('/frames')).length, 1, 'Only one inference request runs at a time')
pending.stream.clear()
completeFrame(Response.json({ ...empty, emissions: [{ label: 'A' }] }))
await inFlight
assert.equal(pending.results.length, 0, 'Clearing discards in-flight results')
pending.stream.stop()

const failure = setup({ fetcher: async () => Response.json({ error: 'Recognition is unavailable.' }, { status: 503 }) })
await failure.stream.start()
assert.equal(failure.states.at(-1)[0], 'error')
assert.equal(failure.queue.length, 0)
const busy = setup({ fetcher: async url => url.endsWith('/frames') ? Response.json({ error: 'Busy' }, { status: 429 }) : Response.json({ session_id: id }) })
await busy.stream.start(); await busy.queue.shift().fn()
assert.equal(busy.states.at(-1)[0], 'waiting'); assert.equal(busy.queue.at(-1).delay, 250)
busy.stream.stop()
const invalid = setup(); invalid.canvas.toBlob = done => done(null)
await invalid.stream.start(); await invalid.queue.shift().fn()
assert.equal(invalid.states.at(-1)[0], 'error')
assert.equal(invalid.calls.at(-1).options.method, 'DELETE')
console.log('PASS backpressure, stale-result rejection, busy retry, server failures and capture errors')

let releaseFirst
let frames = 0
const latest = setup({ fetcher: async url => {
 if (url.endsWith('/frames') && ++frames === 1) return new Promise(resolve => { releaseFirst = resolve })
 return Response.json(url.endsWith('/sessions') ? { session_id: id } : empty)
} })
await latest.stream.start()
const first = latest.queue.shift().fn()
for (let i = 0; i < 10 && !releaseFirst; i++) await Promise.resolve()
latest.video.currentTime++; await latest.queue.shift().fn()
latest.video.currentTime++; await latest.queue.shift().fn()
releaseFirst(Response.json(empty)); await first
for (let i = 0; i < 20; i++) await Promise.resolve()
const timestamps = latest.calls.filter(call => call.url.endsWith('/frames')).map(call => Number(call.options.headers['X-Frame-Timestamp']))
assert.deepEqual(timestamps, [1100, 1300], 'Intermediate waiting frames are replaced with the newest capture')
latest.stream.stop()

console.log('PASS latest-frame replacement')

const browserAssets = new Map([
 ['sign_classifier_canonical.onnx', 'asignx/sign_classifier_canonical.onnx'],
 ['sequence_classifier.onnx', 'asignx/sequence_classifier.onnx'],
 ['hand_landmarker.task', 'mediapipe/hand_landmarker.task'],
])
assert.deepEqual((await readdir(new URL('../public/recognition/', import.meta.url))).sort(),
 [...browserAssets.keys(), 'sign_classifier_canonical.json', 'sequence_classifier.json',
  'sequence_all_signs_v1.json', 'sequence_all_signs_v1.onnx', 'face_landmarker.task', 'pose_landmarker_lite.task'].sort())
for (const [name, source] of browserAssets) {
 const browser = await readFile(new URL('../public/recognition/' + name, import.meta.url))
 const server = await readFile(new URL('../../server/private/models/' + source, import.meta.url))
 assert.deepEqual(browser, server, name + ' matches the server model')
}
console.log('PASS browser recognition assets match the existing models')

const allSignsAsset = name => readFile(new URL('../public/recognition/sequence_all_signs_v1.' + name, import.meta.url))
const metadata = JSON.parse(await allSignsAsset('json'))
assert.deepEqual(metadata.input_shape, ['batch_size', 30, 180])
assert.equal(createHash('sha256').update(await allSignsAsset('onnx')).digest('hex'), metadata.onnx_sha256)
const body = [[.5, .3], [.5, .4], [.75, .5], [.25, .5], [.8, .8], [.2, .8], [.6, .3], [.4, .3]]
const hand = Array.from({ length: 21 }, (_, i) => [.55 + i * .01, .3, 0])
const row = bodyFeatures([hand, null], body)
assert.ok(bodyFrameVisible(row))
assert.deepEqual(Array.from(row.slice(132, 138)), [.5, 0, 1, -.5, 0, 1])
assert.ok(Math.abs(row[156] + .25) < 1e-6)
assert.equal(row[158], 1)
assert.equal(row[170], 0)
assert.equal(bodySequence([row, row, ...Array(4).fill(null), ...Array(8).fill(row)], 30), null)
const engine = createRecognitionEngine(async (kind, input) => {
 if (kind === 'allSigns') {
  assert.equal(input.length, 30 * 180)
  return ['THANK YOU', .95]
 }
 return [null, 0]
}, null, 15, true)
for (const interval of [1000 / 15, 140]) {
 engine.reset()
 const emissions = []
 for (let i = 0; i < 40; i++) {
  const points = hand.map(([x, y, z]) => [x + .2 * Math.sin(i), y, z])
  const result = await engine.process({ Left: points }, i * interval, body)
  emissions.push(...result.emissions)
 }
 assert.deepEqual(emissions.map(item => item.label), ['THANK YOU'])
}
console.log('PASS extended input layout, tracking gaps and whole-sign emission')

// Brief 3-frame whole-sign flicker during static transitions must not emit THANK YOU
let flickerCount = 0
const transitionEngine = createRecognitionEngine(async kind => {
 if (kind === 'allSigns') return flickerCount++ < 3 ? ['THANK YOU', .93] : [null, 0]
 return ['M', .95]
}, null, 15, true)
const transitionEmissions = []
for (let i = 0; i < 30; i++) {
 const points = hand.map(([x, y, z]) => [x + (i < 13 ? .2 * Math.sin(i) : 0), y, z])
 const result = await transitionEngine.process({ Left: points }, i * (1000 / 15), body)
 transitionEmissions.push(...result.emissions.map(item => item.label))
}
assert.equal(transitionEmissions.includes('THANK YOU'), false, 'Brief transition flickers must not emit whole signs')
assert.equal(transitionEmissions.includes('M'), true, 'Static letter still emits after transition')
console.log('PASS automatic suppression of brief dynamic transition flickers during static signing')

// Static hold before a dynamic gesture must trim stale pre-roll instead of keeping 2s of stillness
let sawTrimmedMotion = false
const prerollEngine = createRecognitionEngine(async (kind, input) => {
 if (kind === 'allSigns') {
  const firstStep = input.slice(0, 180)
  const lastStep = input.slice(29 * 180, 30 * 180)
  const wristShift = Math.hypot(lastStep[144] - firstStep[144], lastStep[145] - firstStep[145])
  if (wristShift > 0.5 && firstStep[144] > 0) sawTrimmedMotion = true
  return ['THANK YOU', .95]
 }
 return ['M', .95]
}, null, 15, true)
const staleHand = hand.map(([x, y, z]) => [x - 0.35, y, z])
for (let i = 0; i < 24; i++) {
 await prerollEngine.process({ Left: i < 10 ? staleHand : hand }, i * (1000 / 15), body)
}
const prerollEmissions = []
for (let i = 24; i < 40; i++) {
 const moved = hand.map(([x, y, z]) => [x, y + 0.07 * (i - 24), z])
 const result = await prerollEngine.process({ Left: moved }, i * (1000 / 15), body)
 prerollEmissions.push(...result.emissions.map(item => item.label))
}
assert.equal(sawTrimmedMotion, true, 'Dynamic window trims stale static pre-roll so movement spans the 30 steps')
assert.equal(prerollEmissions.includes('THANK YOU'), true, 'Dynamic gesture emits cleanly after a static hold')
console.log('PASS active-motion pre-roll trimming for dynamic gestures')

// Completed-take evaluation emits a crisp gesture once the hand settles, even without 4 mid-gesture frames >= 0.8
let sawCompletedTake = false
const completedEngine = createRecognitionEngine(async (kind, input) => {
 if (kind === 'allSigns') {
  const firstY = input[145]
  const lastY = input[29 * 180 + 145]
  if (lastY - firstY > 0.8) {
   sawCompletedTake = true
   return ['THANK YOU', .91]
  }
  return [null, 0]
 }
 return [null, 0]
}, null, 15, true)
const completedEmissions = []
for (let i = 0; i < 12; i++) {
 const moved = hand.map(([x, y, z]) => [x, y + 0.05 * i, z])
 const r = await completedEngine.process({ Left: moved }, i * (1000 / 15), body)
 completedEmissions.push(...r.emissions.map(e => e.label))
}
const endPose = hand.map(([x, y, z]) => [x, y + 0.05 * 11, z])
for (let i = 12; i < 18; i++) {
 const r = await completedEngine.process({ Left: endPose }, i * (1000 / 15), body)
 completedEmissions.push(...r.emissions.map(e => e.label))
}
assert.equal(sawCompletedTake, true)
assert.deepEqual(completedEmissions, ['THANK YOU'], 'Completed-take evaluation emits once on settle')
console.log('PASS completed-take dynamic emission and MotionAcceptance')

// Post-whole-sign static cooldown prevents HELP from emitting trailing A while settling
const helpCooldownEngine = createRecognitionEngine(async kind => {
 if (kind === 'allSigns') return ['HELP', .96]
 return ['A', .95]
}, null, 15, true)
const helpEmissions = []
for (let i = 0; i < 12; i++) {
 const moved = hand.map(([x, y, z]) => [x, y + 0.05 * i, z])
 const r = await helpCooldownEngine.process({ Left: moved }, i * (1000 / 15), body)
 helpEmissions.push(...r.emissions.map(e => e.label))
}
const helpEndPose = hand.map(([x, y, z]) => [x, y + 0.05 * 11, z])
for (let i = 12; i < 20; i++) {
 const r = await helpCooldownEngine.process({ Left: helpEndPose }, i * (1000 / 15), body)
 helpEmissions.push(...r.emissions.map(e => e.label))
}
assert.deepEqual(helpEmissions, ['HELP'], 'Trailing A-fist settle right after HELP must not emit A')
for (let i = 20; i < 35; i++) {
 const r = await helpCooldownEngine.process({ Left: helpEndPose }, i * (1000 / 15), body)
 helpEmissions.push(...r.emissions.map(e => e.label))
}
assert.deepEqual(helpEmissions, ['HELP', 'A'], 'Intentional static letter emits normally after cooldown')
console.log('PASS post-whole-sign static cooldown suppresses trailing handshape artifacts')

// Recognition engine preserves per-letter confidence and runner-up alternatives on static readings & emissions
let staticFrames = 0
const altEngine = createRecognitionEngine(async kind => {
 if (kind === 'static') {
  staticFrames++
  return ['A', 0.62, [{ label: 'S', confidence: 0.34 }]]
 }
 return [null, 0]
}, null, 15, false)
let altEmission = null
let altReading = null
for (let i = 0; i < 10; i++) {
 const r = await altEngine.process({ Left: hand }, i * (1000 / 15), body)
 if (!altReading && r.readings.length) altReading = r.readings[0]
 if (r.emissions.length) altEmission = r.emissions[0]
}
assert.ok(staticFrames >= 4)
assert.deepEqual(altReading?.alternatives, [{ label: 'S', confidence: 0.34 }])
assert.equal(altEmission?.label, 'A')
assert.equal(altEmission?.confidence, 0.62)
assert.deepEqual(altEmission?.alternatives, [{ label: 'S', confidence: 0.34 }])
console.log('PASS recognition engine forwards static letter alternatives and confidence')
