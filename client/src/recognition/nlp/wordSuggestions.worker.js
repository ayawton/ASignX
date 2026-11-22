import { createWordLookup } from './wordLookup.js'

let lookup
function loadDictionary() {
 lookup ??= fetch(import.meta.env.BASE_URL + 'dictionary/english-frequency.txt', { signal: AbortSignal.timeout(8000) })
  .then(response => {
   if (!response.ok) throw new Error('English dictionary unavailable')
   return response.text()
  })
  .then(createWordLookup)
 return lookup
}
self.onmessage = async ({ data }) => {
 try {
  if (data.mode === 'preload') { await loadDictionary(); return }
  if (data.mode !== 'sentence') {
   const suggest = await loadDictionary()
   self.postMessage({ id: data.id, result: suggest(data.text, data.previous) })
   return
  }
  const response = await fetch('/api/recognition/nlp/sentence', {
   method: 'POST', headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ text: data.text, fallback: data.fallback }), credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error('Word correction unavailable')
  self.postMessage({ id: data.id, result: await response.json() })
 }
 catch { if (data.mode !== 'preload') self.postMessage({ id: data.id, error: 'Word suggestions are unavailable for this input.' }) }
}
