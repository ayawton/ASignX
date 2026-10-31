// One task in flight and one latest input waiting; no growing worker backlog.
export function createLatestSuggestions(worker, onResult, mode = 'word') {
 let stopped = false, current = null, pending = null, busy = false
 function send() {
  if (stopped || busy || !pending) return
  const request = pending; pending = null; busy = true
  worker.postMessage({ ...request, mode })
 }
 worker.onmessage = ({ data }) => {
  if (stopped) return
  busy = false
  if (current?.id === data.id) onResult(data)
  send()
 }
 return {
  update(text, revision, options = {}) { current = text ? { ...options, id: revision, text } : null; pending = current; send() },
  stop() { stopped = true; current = null; pending = null; worker.terminate() },
 }
}
