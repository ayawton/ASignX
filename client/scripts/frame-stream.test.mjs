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
