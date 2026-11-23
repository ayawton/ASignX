import { createRecognitionEngine } from './recognitionEngine.js'
import { bodyFeatureWidth, bodyLandmarks } from './bodyFeatures.js'

const visionRoot = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304'
const ortRoot = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist'
const assetUrl = name => new URL(import.meta.env.BASE_URL + 'recognition/' + name, document.baseURI).href
let runtime

async function loadRuntime() {
 const [vision, ort] = await Promise.all([
  import(/* @vite-ignore */ visionRoot + '/vision_bundle.mjs'),
  import(/* @vite-ignore */ ortRoot + '/ort.wasm.min.mjs'),
 ])
 ort.env.wasm.numThreads = 1
 ort.env.wasm.wasmPaths = ortRoot + '/'
 const files = await vision.FilesetResolver.forVisionTasks(visionRoot + '/wasm')
 async function loadModel(name, shape) {
  const response = await fetch(assetUrl(name + '.json'))
  if (!response.ok) throw new Error('Recognition model information could not be loaded.')
  const metadata = await response.json()
  const session = await ort.InferenceSession.create(assetUrl(name + '.onnx'), { executionProviders: ['wasm'] })
  return { metadata, session, shape }
 }
 const [staticModel, sequenceModel, allSignsModel] = await Promise.all([
  loadModel('sign_classifier_canonical', [1, 63]),
  loadModel('sequence_classifier', [1, 30, 126]),
  loadModel('sequence_all_signs_v1', [1, 30, bodyFeatureWidth]).catch(() => null),
 ])
 return { vision, ort, files, models: { static: staticModel, sequence: sequenceModel, allSigns: allSignsModel } }
}

async function createBrowserRecognizer() {
 runtime ??= loadRuntime().catch(error => { runtime = undefined; throw error })
 const { vision, ort, files, models } = await runtime
 const detector = await vision.HandLandmarker.createFromOptions(files, {
  baseOptions: { modelAssetPath: assetUrl('hand_landmarker.task') },
  runningMode: 'VIDEO',
  numHands: 2,
 })
 let pose, face
 if (models.allSigns) {
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
  const { metadata, session, shape } = models[kind]
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
 const engine = createRecognitionEngine(predict, models.static.metadata.static_hand_preprocessing,
  models.sequence.metadata.sampling_fps ?? 15, Boolean(face))
 return {
  reset: engine.reset,
  close() { detector.close(); pose?.close(); face?.close() },
  process(video, timestamp) {
   const result = detector.detectForVideo(video, timestamp)
   const hands = {}
   result.landmarks.forEach((points, i) => {
    const side = result.handedness[i]?.[0]?.categoryName
    if (side === 'Left' || side === 'Right') hands[side] = points.map(({ x, y, z }) => [x, y, z])
   })
   const body = face && bodyLandmarks(pose.detectForVideo(video, timestamp).landmarks[0],
    face.detectForVideo(video, timestamp).faceLandmarks[0])
   return engine.process(hands, timestamp, body)
  },
 }
}

export function createBrowserFrameStream(video, { onState, onResult }) {
 let stopped = false, timer, recognizer, previousTime = -1, generation = 0, resetRequested = false
 function stop() {
  stopped = true
  clearTimeout(timer)
  recognizer?.close()
  recognizer = null
 }
 async function tick() {
  if (stopped) return
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
    if (!stopped && currentGeneration === generation) onResult(result)
   }
  } catch {
   if (!stopped) {
    stop()
    onState('error', 'Recognition stopped. Restart the camera to try again.')
   }
  }
  if (!stopped) timer = setTimeout(tick, Math.max(0, 1000 / 15 - (performance.now() - timestamp)))
 }
 return {
  async start() {
   onState('loading')
   try {
    const instance = await createBrowserRecognizer()
    if (stopped) { instance.close(); return }
    recognizer = instance
    onState('ready')
    timer = setTimeout(tick, 0)
   } catch {
    if (!stopped) {
     stop()
     onState('error', 'The browser could not load recognition. Check your connection and restart the camera.')
    }
   }
  },
  clear() { generation++; resetRequested = true },
  stop,
 }
}
