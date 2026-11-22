import { createWordLookup } from './wordLookup.js'
import { createWasmSyntaxEngine } from './wasmSyntaxEngine.js'

let unigramPromise
let enginePromise
let lookupFallback

function fetchDictionary(path, timeoutMs = 10000) {
 return fetch(import.meta.env.BASE_URL + path, { signal: AbortSignal.timeout(timeoutMs) }).then(response => {
  if (!response.ok) throw new Error(`Dictionary unavailable: ${path}`)
  return response.text()
 })
}

function loadUnigrams() {
 unigramPromise ??= fetchDictionary('dictionary/english-frequency.txt', 8000)
 return unigramPromise
}

function loadFallbackLookup() {
 lookupFallback ??= loadUnigrams().then(createWordLookup)
 return lookupFallback
}

function loadSyntaxEngine() {
 enginePromise ??= Promise.all([
  loadUnigrams(),
  fetchDictionary('dictionary/english-bigrams.txt', 12000),
 ]).then(([unigrams, bigrams]) => createWasmSyntaxEngine({ unigrams, bigrams }))
 return enginePromise
}

async function fallbackSentence(data) {
 const response = await fetch('/api/recognition/nlp/sentence', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: data.text, fallback: data.fallback }),
  credentials: 'same-origin',
  cache: 'no-store',
  signal: AbortSignal.timeout(8000),
 })
 if (!response.ok) throw new Error('Word correction unavailable')
 return response.json()
}

self.onmessage = async ({ data }) => {
 try {
  if (data.mode === 'preload') {
   await loadSyntaxEngine().catch(() => loadFallbackLookup())
   return
  }
  if (data.mode !== 'sentence') {
   try {
    const engine = await loadSyntaxEngine()
    self.postMessage({ id: data.id, result: engine.suggestWord(data.text, data.previous) })
    return
   } catch {
    const suggest = await loadFallbackLookup()
    self.postMessage({ id: data.id, result: suggest(data.text, data.previous) })
    return
   }
  }
  try {
   const engine = await loadSyntaxEngine()
   self.postMessage({ id: data.id, result: engine.syntaxSentence(data.text, data.fallback) })
   return
  } catch {
   self.postMessage({ id: data.id, result: await fallbackSentence(data) })
  }
 } catch {
  if (data.mode !== 'preload') {
   self.postMessage({ id: data.id, error: 'Word suggestions are unavailable for this input.' })
  }
  if (data.preserveSigns) {
   self.postMessage({ id: data.id, result: { suggestions: [] } })
   return
  }
  const response = await fetch('/api/recognition/nlp/sentence', {
   method: 'POST', headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ text: data.text, fallback: data.fallback }), credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error('Word correction unavailable')
  self.postMessage({ id: data.id, result: await response.json() })
 }
}
