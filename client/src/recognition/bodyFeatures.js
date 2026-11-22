export const bodyFeatureWidth = 180
const poseSlots = [[0, 0], [2, 11], [3, 12], [4, 13], [5, 14]]
const faceSlots = [[1, 152], [6, 127], [7, 356]]

export function bodyLandmarks(pose, face) {
 const body = Array(8).fill(null)
 for (const [slot, index] of poseSlots) {
  const point = pose?.[index]
  // MediaPipe's browser landmark result exposes visibility. Native results also expose presence.
  if (point?.visibility >= .5 && (point.presence ?? 1) >= .5) body[slot] = [point.x, point.y]
 }
 for (const [slot, index] of faceSlots) {
  const point = face?.[index]
  if (point) body[slot] = [point.x, point.y]
 }
 return body
}

export function bodyFeatures(hands, body) {
 const row = new Float32Array(bodyFeatureWidth)
 const wrists = hands.map((points, slot) => {
  if (!points) return null
  const wrist = points[0]
  const centered = points.map(point => point.map((value, axis) => value - wrist[axis]))
  const radius = Math.max(...centered.map(point => Math.hypot(...point)))
  if (!(radius > 1e-8) || !Number.isFinite(radius)) return null
  row.set(centered.flatMap(point => point.map(value => value / radius)), slot * 63)
  return wrist
 })
 const left = body?.[2], right = body?.[3]
 const width = left && right && Math.hypot(left[0] - right[0], left[1] - right[1])
 if (!(width >= 1e-5) || !Number.isFinite(width)) return row
 const center = left.map((value, axis) => (value + right[axis]) / 2)
 function write(offset, point, origin, scale) {
  if (point && Number.isFinite(point[0]) && Number.isFinite(point[1])) {
   row.set([(point[0] - origin[0]) / scale, (point[1] - origin[1]) / scale, 1], offset)
  }
 }
 const temples = body.slice(6, 8)
 const anchors = [...body.slice(0, 6), ...wrists, ...temples]
 anchors.forEach((point, i) => write(126 + i * 3, point, center, width))
 if (!row[152] || !row[155]) return row
 const headWidth = Math.hypot(temples[0][0] - temples[1][0], temples[0][1] - temples[1][1])
 if (headWidth < 1e-5) {
  row.fill(0, 150, 156)
  return row
 }
 wrists.forEach((wrist, slot) => {
  if (!wrist) return
  temples.forEach((temple, index) => {
   const offset = 156 + slot * 12 + index * 6
   write(offset, wrist, temple, headWidth)
   write(offset + 3, hands[slot][8], temple, headWidth)
  })
 })
 return row
}

export function bodyFrameVisible(row) {
 return Boolean(row && row[134] && row[137] && (row[146] || row[149]) && row[152] && row[155])
}

export function bodySequence(rows, length, timestamps = rows.map((_, i) => i * 1000 / 15)) {
 const first = rows.findIndex(bodyFrameVisible)
 const last = rows.findLastIndex(bodyFrameVisible)
 const duration = timestamps[last] - timestamps[first]
 if (first < 0 || last - first + 1 < 5 || duration < 550) return null
 rows = rows.slice(first, last + 1)
 timestamps = timestamps.slice(first, last + 1)
 let visible = 0, gap = 0
 for (const row of rows) {
  if (bodyFrameVisible(row)) { visible++; gap = 0 }
  else if (++gap > 3) return null
 }
 if (visible / rows.length < .65) return null
 const input = new Float32Array(length * bodyFeatureWidth)
 const zero = new Float32Array(bodyFeatureWidth)
 let upper = 0
 for (let i = 0; i < length; i++) {
  const time = i === length - 1 ? timestamps.at(-1) : timestamps[0] + i * duration / (length - 1)
  while (upper < rows.length - 1 && timestamps[upper] < time) upper++
  const lower = timestamps[upper] === time ? upper : upper - 1
  const low = rows[lower] ?? zero
  const high = rows[upper] ?? zero
  const weight = lower === upper ? 0 : (time - timestamps[lower]) / (timestamps[upper] - timestamps[lower])
  const offset = i * bodyFeatureWidth
  for (const start of [0, 63]) {
   const end = start + 63
   if (!low.subarray(start, end).some(Boolean) || !high.subarray(start, end).some(Boolean)) continue
   for (let j = start; j < end; j++) input[offset + j] = low[j] + weight * (high[j] - low[j])
  }
  for (let j = 126; j < bodyFeatureWidth; j += 3) {
   if (!low[j + 2] || !high[j + 2]) continue
   input[offset + j] = low[j] + weight * (high[j] - low[j])
   input[offset + j + 1] = low[j + 1] + weight * (high[j + 1] - low[j + 1])
   input[offset + j + 2] = 1
  }
 }
 return input
}
