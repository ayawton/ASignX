import { createRecognitionEngine } from './recognitionEngine.js'
import { bodyFeatureWidth, bodyLandmarks } from './bodyFeatures.js'

const visionRoot = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304'
const ortRoot = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist'
const assetUrl = name => new URL(import.meta.env.BASE_URL + 'recognition/' + name, document.baseURI).href
let coreRuntime
let sequenceRuntime

async function loadModel(ort, name, shape) {
 const response = await fetch(assetUrl(name + '.json'))
 if (!response.ok) throw new Error('Recognition model information could not be loaded.')
 const metadata = await response.json()
 const session = await ort.InferenceSession.create(assetUrl(name + '.onnx'), { executionProviders: ['wasm'] })
 return { metadata, session, shape }
}

async function loadCoreRuntime() {
 const [vision, ort] = await Promise.all([
  import(/* @vite-ignore */ visionRoot + '/vision_bundle.mjs'),
  import(/* @vite-ignore */ ortRoot + '/ort.wasm.min.mjs'),
 ])
 ort.env.wasm.numThreads = 1
 ort.env.wasm.wasmPaths = ortRoot + '/'
 const [files, staticModel] = await Promise.all([
  vision.FilesetResolver.forVisionTasks(visionRoot + '/wasm'),
  loadModel(ort, 'sign_classifier_canonical', [1, 63]),
 ])
 return { vision, ort, files, staticModel }
}

async function loadSequenceModels(ort) {
 const [sequence, allSigns] = await Promise.all([
  loadModel(ort, 'sequence_classifier', [1, 30, 126]),
  loadModel(ort, 'sequence_all_signs_v1', [1, 30, bodyFeatureWidth]).catch(() => null),
 ])
 return { sequence, allSigns }
}

async function createBrowserRecognizer({ staticOnly = false } = {}) {
 coreRuntime ??= loadCoreRuntime().catch(error => { coreRuntime = undefined; throw error })
 const { vision, ort, files, staticModel } = await coreRuntime
 const extraModels = staticOnly
  ? { sequence: null, allSigns: null }
  : await (sequenceRuntime ??= loadSequenceModels(ort).catch(error => { sequenceRuntime = undefined; throw error }))
 const models = { static: staticModel, ...extraModels }
 const detector = await vision.HandLandmarker.createFromOptions(files, {
  baseOptions: { modelAssetPath: assetUrl('hand_landmarker.task') },
  runningMode: 'VIDEO',
  numHands: 2,
 })
 let pose = null
 let face = null
 if (!staticOnly && models.allSigns) {
  try {
   pose = await vision.PoseLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: assetUrl('pose_landmarker_lite.task') },
    runningMode: 'VIDEO', numPoses: 1,
   })
   face = await vision.FaceLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: assetUrl('face_landmarker.task') },
    runningMode: 'VIDEO', numFaces: 1,
   })
  } catch {
   pose?.close()
   pose = null
  }
 }
 async function predict(kind, features) {
  const model = models[kind]
  if (!model) return [null, 0]
  const { metadata, session, shape } = model
  const input = new ort.Tensor('float32', features, shape)
  try {
   const outputs = await session.run({ [metadata.input_name]: input }, [metadata.output_name])
   const output = outputs[metadata.output_name]
   try {
    const logits = output.data
    const peak = Math.max(...logits)
    let sum = 0
    for (let i = 0; i < logits.length; i++) sum += Math.exp(logits[i] - peak)
    const peakIndex = logits.indexOf(peak)
    const confidence = 1 / sum
    const rawLabel = metadata.labels[peakIndex]
    const label = confidence >= .8 && rawLabel !== 'BACKGROUND' ? rawLabel?.replaceAll('_', ' ') : null
    let alternatives
    if (kind === 'static' && label) {
     let runnerUp = null
     let runnerProb = 0
     for (let i = 0; i < logits.length; i++) {
      if (i === peakIndex) continue
      const prob = Math.exp(logits[i] - peak) / sum
      if (prob > runnerProb) {
       runnerProb = prob
       runnerUp = metadata.labels[i]
      }
     }
     alternatives = runnerUp && runnerProb >= .03 ? [{ label: runnerUp, confidence: runnerProb }] : []
    }
    return [label, confidence, alternatives]
   } finally { output.dispose() }
  } finally { input.dispose() }
 }
 const samplingFps = models.sequence?.metadata.sampling_fps ?? 15
 const engine = createRecognitionEngine(predict, models.static.metadata.static_hand_preprocessing,
  samplingFps, Boolean(face))
 return {
  reset: engine.reset,
  close() { detector.close(); pose?.close(); face?.close() },
  async process(video, timestamp) {
   const result = detector.detectForVideo(video, timestamp)
   const hands = {}
   let handX = null
   result.landmarks.forEach((points, i) => {
    const side = result.handedness[i]?.[0]?.categoryName
    if (side === 'Left' || side === 'Right') hands[side] = points.map(({ x, y, z }) => [x, y, z])
    if (handX === null && points[0] && points[9]) {
     handX = 1 - (points[0].x + points[9].x) / 2
    }
   })
   const body = face && bodyLandmarks(pose.detectForVideo(video, timestamp).landmarks[0],
    face.detectForVideo(video, timestamp).faceLandmarks[0])
   const output = await engine.process(hands, timestamp, body)
   return { ...output, handX }
  },
 }
}

export function createBrowserFrameStream(video, { onState, onResult, staticOnly = false }) {
 let stopped = false, paused = false, timer, recognizer, previousTime = -1, generation = 0, resetRequested = false
 function stop() {
  stopped = true
  clearTimeout(timer)
  recognizer?.close()
  recognizer = null
 }
 function setPaused(nextPaused) {
  const value = Boolean(nextPaused)
  if (paused === value) return
  paused = value
  if (paused) {
   clearTimeout(timer)
   timer = undefined
   generation++
   resetRequested = true
  } else if (!stopped && recognizer && !timer) {
   timer = setTimeout(tick, 0)
  }
 }
 async function tick() {
  timer = undefined
  if (stopped || paused) return
  const timestamp = performance.now()
  const currentGeneration = generation
  try {
   if (resetRequested) {
    recognizer.reset()
    resetRequested = false
   }
   if (document.visibilityState !== 'hidden' && video.readyState >= 2 &&
       !video.paused && video.currentTime !== previousTime) {
    previousTime = video.currentTime
    const result = await recognizer.process(video, timestamp)
    if (!stopped && !paused && currentGeneration === generation) onResult(result)
   }
  } catch {
   if (!stopped) {
    stop()
    onState('error', 'Recognition stopped. Restart the camera to try again.')
   }
  }
  if (!stopped && !paused) timer = setTimeout(tick, Math.max(0, 1000 / 15 - (performance.now() - timestamp)))
 }
 return {
  async start() {
   onState('loading')
   try {
    const instance = await createBrowserRecognizer({ staticOnly })
    if (stopped) { instance.close(); return }
    recognizer = instance
    onState('ready')
    if (!paused) timer = setTimeout(tick, 0)
   } catch {
    if (!stopped) {
     stop()
     onState('error', 'The browser could not load recognition. Check your connection and restart the camera.')
    }
   }
  },
  clear() { generation++; resetRequested = true },
  setPaused,
  stop,
 }
}
