import { bodyFeatures, bodyFrameVisible, bodySequence } from './bodyFeatures.js'

const sides = ['Left', 'Right']
const windowSize = 30
const trackedTips = [0, 4, 8, 12, 16, 20]
const distance = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]))
const distance2d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
const radius = points => Math.max(...points.map(point => distance(point, points[0])))
const medianOf = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const quantile = (values, q) => {
 const sorted = [...values].sort((a, b) => a - b)
 const pos = (sorted.length - 1) * q
 const lo = Math.floor(pos)
 const hi = Math.ceil(pos)
 return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo])
}

function hasAcceptedMotion(samples, minExcursion = .35, minMotionSeconds = .12, minSpeed = .3) {
 for (let side = 0; side < 2; side++) {
  const segments = []
  let current = []
  for (const sample of samples) {
   const points = sample.hands[side]
   if (!points) {
    if (current.length) segments.push(current)
    current = []
    continue
   }
   if (current.length && sample.time - current.at(-1).time > 200) {
    segments.push(current)
    current = []
   }
   current.push({ time: sample.time, points })
  }
  if (current.length) segments.push(current)
  for (const segment of segments) {
   if (segment.length < 5) continue
   const scale = medianOf(segment.map(entry => distance2d(entry.points[5], entry.points[17])))
   if (!(scale > 1e-5) || !Number.isFinite(scale)) continue
   const smooth = []
   for (let i = 1; i < segment.length - 1; i++) {
    smooth.push({
     time: segment[i].time,
     tips: trackedTips.map(idx => [
      medianOf([segment[i - 1].points[idx][0], segment[i].points[idx][0], segment[i + 1].points[idx][0]]),
      medianOf([segment[i - 1].points[idx][1], segment[i].points[idx][1], segment[i + 1].points[idx][1]]),
     ]),
    })
   }
   let excursion = 0
   for (let j = 0; j < trackedTips.length; j++) {
    const xs = smooth.map(item => item.tips[j][0])
    const ys = smooth.map(item => item.tips[j][1])
    excursion = Math.max(excursion, Math.hypot(quantile(xs, .95) - quantile(xs, .05), quantile(ys, .95) - quantile(ys, .05)) / scale)
   }
   let duration = 0
   for (let i = 1; i < smooth.length; i++) {
    const dt = (smooth[i].time - smooth[i - 1].time) / 1000
    if (dt <= 0) continue
    let maxSpeed = 0
    for (let j = 0; j < trackedTips.length; j++) {
     maxSpeed = Math.max(maxSpeed, distance2d(smooth[i].tips[j], smooth[i - 1].tips[j]) / scale / dt)
    }
    if (maxSpeed >= minSpeed) duration += dt
   }
   if (excursion >= minExcursion && duration >= minMotionSeconds) return true
  }
 }
 return false
}

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
 return (label, timestamp, minRequired = required) => {
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
  const stable = count >= minRequired ? label : null
  if (!stable || stable === emitted) return [stable, null]
  emitted = stable
  return [stable, emitted]
 }
}

export function createRecognitionEngine(predict, staticMode, samplingFps, allSigns = false) {
 const interval = 1000 / samplingFps
 const motionThreshold = allSigns ? .015 : .045
 let stable, motion, frames, bodyFrames, nextSample, lastMotion, motionStart, takeEvaluated, emittedInTake, suppressStaticUntil, dynamic, stabilizeMotion
 function reset() {
  stable = sides.map(() => stabilizer(5))
  motion = sides.map(() => [])
  frames = []
  bodyFrames = []
  nextSample = null
  lastMotion = -Infinity
  motionStart = null
  takeEvaluated = false
  emittedInTake = false
  suppressStaticUntil = -Infinity
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
  return travel / (30 * (timestamp - history[0].time) / 1000) >= motionThreshold
 }
 function append(frame) {
  frames.push(frame)
  if (frames.length > windowSize) frames.shift()
  nextSample += interval
 }
 return {
  reset,
  async process(detected, timestamp, body) {
   const frame = sides.map(side => detected[side] ?? null)
   const readings = [], emissions = []
   let anyMoving = false
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
    if (moving) {
     lastMotion = timestamp
     anyMoving = true
    }
    const features = Float32Array.from(points.flatMap(point => point.map((value, axis) =>
     (value - points[0][axis]) / scale * (axis === 0 && side === 'Left' && staticMode === 'left_x_reflection_v1' ? -1 : 1))))
    const [label, confidence, alternatives] = await predict('static', features)
    readings.push({ hand: side, label: moving ? null : label, confidence, ...(alternatives?.length ? { alternatives } : {}) })
   }
   const bodyFrame = allSigns && bodyFeatures(frame, body)
   const visible = bodyFrameVisible(bodyFrame)
   const active = readings.length > 0 && timestamp - lastMotion <= (visible ? 650 : 350)
   if (allSigns) {
    if (timestamp - (bodyFrames.at(-1)?.time ?? timestamp) > 400) bodyFrames = []
    if (anyMoving && motionStart == null) {
     motionStart = timestamp - 200
     takeEvaluated = false
     emittedInTake = false
    } else if (anyMoving) {
     takeEvaluated = false
    }
    bodyFrames.push({ time: timestamp, features: bodyFrame, hands: frame })
    const windowCutoff = timestamp - (motionStart != null ? 4000 : interval * windowSize)
    const cutoff = motionStart != null ? Math.max(windowCutoff, motionStart) : windowCutoff
    while (bodyFrames.length && bodyFrames[0].time < cutoff) bodyFrames.shift()
   }
   nextSample ??= timestamp
   if (timestamp + 1e-5 >= nextSample) {
    if (timestamp - nextSample > interval * 3) {
     frames = []
     nextSample = timestamp
    }
    while (timestamp - nextSample >= interval - 1e-5) append([null, null])
    append(frame)
    const completedReady = allSigns && visible && !anyMoving && motionStart != null && timestamp - lastMotion >= 150 && !takeEvaluated && !emittedInTake
    if (completedReady) {
     takeEvaluated = true
     const takeFrames = bodyFrames.filter(sample => sample.time <= lastMotion + 100)
     const completed = hasAcceptedMotion(takeFrames) && bodySequence(takeFrames.map(sample => sample.features), windowSize, takeFrames.map(sample => sample.time))
     if (completed) {
      const [label, confidence] = await predict('allSigns', completed)
      if (label) {
       emittedInTake = true
       dynamic = { hand: 'Motion', label, confidence, stable: label }
       emissions.push({ hand: 'Motion', label, confidence })
       if (label.length > 1) {
        suppressStaticUntil = timestamp + 500
        stable.forEach(fn => fn(null, timestamp))
       }
      }
     }
    }
    if (!emittedInTake) {
     const extended = active && visible && bodySequence(bodyFrames.map(sample => sample.features), windowSize,
      bodyFrames.map(sample => sample.time))
     const legacy = active && !visible && sequenceFeatures(frames)
     const [label, confidence] = extended ? await predict('allSigns', extended) :
      legacy ? await predict('sequence', legacy) : [null, 0]
     const [steady, emitted] = stabilizeMotion(label, timestamp, label && label.length > 1 ? 4 : 3)
     dynamic = active ? { hand: 'Motion', label, confidence, stable: steady } : null
     if (emitted) {
      emittedInTake = true
      emissions.push({ hand: 'Motion', label: emitted, confidence })
      if (emitted.length > 1) {
       suppressStaticUntil = timestamp + 500
       stable.forEach(fn => fn(null, timestamp))
      }
     }
    }
   }
   if (allSigns && !active) {
    motionStart = null
    takeEvaluated = false
    emittedInTake = false
   }
   let staticStable = false
   const suppressStatic = active || timestamp < suppressStaticUntil
   for (const reading of readings) {
    const [steady, emitted] = stable[sides.indexOf(reading.hand)](suppressStatic ? null : reading.label, timestamp)
    reading.stable = steady
    if (steady) staticStable = true
    if (emitted) emissions.push({ hand: reading.hand, label: emitted, confidence: reading.confidence, ...(reading.alternatives?.length ? { alternatives: reading.alternatives } : {}) })
   }
   if (staticStable) stabilizeMotion(null, timestamp)
   return {
    hands: readings.map(({ hand }) => ({ handedness: hand })),
    allSigns, bodyVisible: visible,
    readings, emissions, dynamic: active ? dynamic : null, moving: active,
   }
  },
 }
}
