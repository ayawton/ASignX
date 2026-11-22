const sides = ['Left', 'Right']
const windowSize = 30
const distance = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]))
const radius = points => Math.max(...points.map(point => distance(point, points[0])))

export function sequenceFeatures(frames) {
 if (frames.length < 15 || frames.filter(frame => frame.some(Boolean)).length < frames.length / 2) return null
 const filled = frames.map(frame => [...frame])
 for (let hand = 0; hand < 2; hand++) {
  const known = frames.flatMap((frame, i) => frame[hand] ? [i] : [])
  if (!known.length) continue
  let gap = 0
  let next = 0
  for (let i = 0; i < frames.length; i++) {
   gap = frames[i][hand] ? 0 : gap + 1
   if (gap > 3) return null
   while (next < known.length && known[next] < i) next++
   const before = known[Math.max(0, next - 1)]
   const after = known[Math.min(next, known.length - 1)]
   const weight = before === after ? 0 : (i - before) / (after - before)
   filled[i][hand] ??= frames[before][hand].map((point, p) =>
    point.map((value, axis) => value + weight * (frames[after][hand][p][axis] - value)))
  }
 }
 const hands = filled.flat().filter(Boolean)
 const origin = hands[0][0]
 const radii = hands.map(radius).filter(value => value > 1e-8).sort((a, b) => a - b)
 if (!radii.length) return null
 const scale = (radii[Math.floor((radii.length - 1) / 2)] + radii[Math.floor(radii.length / 2)]) / 2
 const values = new Float32Array(windowSize * 126)
 filled.forEach((frame, i) => frame.forEach((points, hand) => {
  if (!points) return
  const offset = (windowSize - filled.length + i) * 126 + hand * 63
  points.forEach((point, p) => point.forEach((value, axis) => {
   values[offset + p * 3 + axis] = (value - origin[axis]) / scale
  }))
 }))
 return values
}

function stabilizer(required) {
 let candidate, count = 0, emitted, missingSince
 return (label, timestamp) => {
  if (!label) {
   candidate = null
   count = 0
   missingSince ??= timestamp
  }
  if (missingSince != null && timestamp - missingSince >= 250) emitted = null
  if (!label) return [null, null]
  missingSince = null
  count = candidate === label ? count + 1 : 1
  candidate = label
  const stable = count >= required ? label : null
  if (!stable || stable === emitted) return [stable, null]
  emitted = stable
  return [stable, emitted]
 }
}

export function createRecognitionEngine(predict, staticMode, samplingFps) {
 const interval = 1000 / samplingFps
 let stable, motion, frames, nextSample, lastMotion, dynamic, stabilizeMotion
 function reset() {
  stable = sides.map(() => stabilizer(5))
  motion = sides.map(() => [])
  frames = []
  nextSample = null
  lastMotion = -Infinity
  dynamic = null
  stabilizeMotion = stabilizer(3)
 }
 reset()
 function isMoving(history, points, timestamp) {
  if (history.length && timestamp - history.at(-1).time > 500) history.length = 0
  const tips = [0, 4, 8, 12, 16, 20].map(i => points[i])
  history.push({ time: timestamp, tips })
  while (history.length > 2 && timestamp - history[0].time > 7000 / 30) history.shift()
  if (history.length < 2) return false
  const travel = history.slice(1).reduce((sum, sample, i) =>
   sum + sample.tips.reduce((total, tip, j) => total + distance(tip, history[i].tips[j]), 0) / 6, 0)
  return travel / (30 * (timestamp - history[0].time) / 1000) >= .045
 }
 function append(frame) {
  frames.push(frame)
  if (frames.length > windowSize) frames.shift()
  nextSample += interval
 }
 return {
  reset,
  async process(detected, timestamp) {
   const frame = sides.map(side => detected[side] ?? null)
   const readings = [], emissions = []
   for (const [i, side] of sides.entries()) {
    const points = frame[i]
    const scale = points && radius(points)
    if (!(scale > 1e-8) || !Number.isFinite(scale)) {
     frame[i] = null
     motion[i].length = 0
     stable[i](null, timestamp)
     continue
    }
    const moving = isMoving(motion[i], points, timestamp)
    if (moving) lastMotion = timestamp
    const features = Float32Array.from(points.flatMap(point => point.map((value, axis) =>
     (value - points[0][axis]) / scale * (axis === 0 && side === 'Left' && staticMode === 'left_x_reflection_v1' ? -1 : 1))))
    const [label, confidence] = await predict('static', features)
    readings.push({ hand: side, label: moving ? null : label, confidence })
   }
   const active = readings.length > 0 && timestamp - lastMotion <= 350
   nextSample ??= timestamp
   if (timestamp + 1e-5 >= nextSample) {
    if (timestamp - nextSample > interval * 3) {
     frames = []
     nextSample = timestamp
    }
    while (timestamp - nextSample >= interval - 1e-5) append([null, null])
    append(frame)
    const features = active && sequenceFeatures(frames)
    const [label, confidence] = features ? await predict('sequence', features) : [null, 0]
    const [steady, emitted] = stabilizeMotion(label, timestamp)
    dynamic = active ? { hand: 'Motion', label, confidence, stable: steady } : null
    if (emitted) emissions.push({ hand: 'Motion', label: emitted, confidence })
   }
   for (const reading of readings) {
    const [steady, emitted] = stable[sides.indexOf(reading.hand)](active ? null : reading.label, timestamp)
    reading.stable = steady
    if (emitted) emissions.push({ hand: reading.hand, label: emitted, confidence: reading.confidence })
   }
   return {
    hands: readings.map(({ hand }) => ({ handedness: hand })),
    readings, emissions, dynamic: active ? dynamic : null, moving: active,
   }
  },
 }
}
