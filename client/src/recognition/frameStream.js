// Camera capture only: all detection, preprocessing and inference happen on the server.
export function createFrameStream(video, {
 onState, onResult, fetcher = fetch,
 canvasFactory = () => document.createElement('canvas'),
 schedule = setTimeout, cancel = clearTimeout,
 clock = () => performance.now(), visible = () => document.visibilityState !== 'hidden',
}) {
 let stopped = false, session = null, timer, retryTimer, generation = 0, resetRequested = false, previousTime = -1
 let pending = null, sending = false, capturing = false, coolingDown = false
 const abort = new AbortController()
 const canvas = canvasFactory()
 const context = canvas.getContext('2d', { alpha: false })
 async function request(path, options = {}) {
  const timeout = new AbortController()
  const relay = () => timeout.abort()
  abort.signal.addEventListener('abort', relay, { once: true })
  if (abort.signal.aborted) timeout.abort()
  const deadline = setTimeout(() => timeout.abort(), 15000)
  try {
   const response = await fetcher(`/api/recognition${path}`, { ...options, signal: timeout.signal, cache: 'no-store', credentials: 'same-origin' })
   const data = response.status === 204 ? null : await response.json()
   if (!response.ok) { const error = new Error(data?.error || 'Recognition is unavailable. Try again.'); error.status = response.status; throw error }
   return data
  } finally { clearTimeout(deadline); abort.signal.removeEventListener('abort', relay) }
 }
 function removeSession() {
  if (session) {
   const id = session; session = null
   void fetcher(`/api/recognition/sessions/${id}`, { method: 'DELETE', keepalive: true, credentials: 'same-origin' }).catch(() => {})
  }
 }
 // Serialize stateful inference; retain only the newest waiting frame.
 async function drain() {
  if (stopped || sending || coolingDown || (!pending && !resetRequested)) return
  sending = true
  const currentGeneration = generation
  try {
   if (resetRequested) {
    await request(`/sessions/${session}/reset`, { method: 'POST' })
    if (currentGeneration === generation) resetRequested = false
   }
   if (!resetRequested && pending) {
    const frame = pending; pending = null
    const data = await request(`/sessions/${session}/frames`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg', 'X-Frame-Timestamp': String(frame.timestamp) }, body: frame.jpeg })
    if (!stopped && currentGeneration === generation) onResult(data)
   }
  } catch (error) {
   if (stopped) return
   if (error.status === 429) {
    onState('waiting'); coolingDown = true
    retryTimer = schedule(() => { coolingDown = false; void drain() }, 250)
   } else { fail(error) }
  } finally { sending = false }
  if (!stopped && !coolingDown) void drain()
 }
 function fail(error) {
  stopped = true; pending = null; cancel(timer); cancel(retryTimer); removeSession()
  onState('error', error.name === 'AbortError' ? 'Recognition timed out. Check your connection and retry.' : error.message)
 }
 async function tick() {
  if (stopped) return
  // Schedule capture independently of network latency. Encoding is also bounded.
  timer = schedule(tick, 1000 / 15)
  if (capturing || !visible()) return
  const started = clock(), currentGeneration = generation
  capturing = true
  try {
   if (video.readyState >= 2 && !video.paused && video.currentTime !== previousTime) {
    previousTime = video.currentTime
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight))
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale)); canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const jpeg = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .7))
    if (stopped || currentGeneration !== generation) return
    if (!jpeg || jpeg.size > 256 * 1024) throw new Error('The camera frame could not be prepared. Try a lower camera resolution.')
    pending = { jpeg, timestamp: started }
    return drain()
   }
  } catch (error) {
   if (stopped) return
   fail(error)
  } finally { capturing = false }
 }
 return {
  async start() {
   try {
    await Promise.resolve()
    if (stopped) return
    onState('loading')
    if (!context || !canvas.toBlob) throw new Error('Your browser cannot prepare camera frames.')
    const data = await request('/sessions', { method: 'POST' })
    if (!/^[A-Za-z0-9_-]{43}$/.test(data?.session_id)) throw new Error('The recognition service returned an invalid session.')
    session = data.session_id
    if (stopped) { removeSession(); return }
    onState('ready'); timer = schedule(tick, 0)
   } catch (error) { if (!stopped) { stopped = true; onState('error', error.name === 'AbortError' ? 'Recognition timed out. Check your connection and retry.' : error.message) } }
  },
  clear() { generation++; pending = null; resetRequested = true; void drain() },
  stop() { stopped = true; generation++; pending = null; cancel(timer); cancel(retryTimer); abort.abort(); removeSession() },
 }
}
