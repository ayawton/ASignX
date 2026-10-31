// Wait for a spelling pause and a matching NLP result, in either arrival order.
export function createAutomaticWords({ onFinish, schedule = setTimeout, cancel = clearTimeout, pauseMs = 2000 }) {
 let current = null, timer, stopped = false, failed = false
 function finish() {
  if (stopped || !current?.ready || (!failed && !current.response)) return
  const item = current; current = null
  const best = item.response?.result?.suggestions?.[0]
  onFinish(best && !best.uncertain ? best.text : item.fallback, item.id)
 }
 return {
  update(text, id, fallback = text) {
   cancel(timer)
   current = text ? { text, fallback, id, ready: false, response: null } : null
   if (current) timer = schedule(() => { if (current?.id === id) { current.ready = true; finish() } }, pauseMs)
  },
  receive(response) { if (current?.id === response.id) { current.response = response; finish() } },
  fail() { failed = true; finish() },
  stop() { stopped = true; cancel(timer); current = null },
 }
}
