// Run after npm run build: verifies the bundled worker's backend transport.
import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import { Worker } from 'node:worker_threads'
import { once } from 'node:events'

const assets = new URL('../dist/assets/', import.meta.url)
const file = (await readdir(assets)).find(name => /^wordSuggestions\.worker-.*\.js$/.test(name))
assert.ok(file, 'Production build includes the NLP worker')
const source = `import { parentPort } from 'node:worker_threads';
globalThis.self = { postMessage: data => parentPort.postMessage(data) };
globalThis.fetch = async (url, options) => {
 if (!['/api/recognition/nlp/word', '/api/recognition/nlp/sentence'].includes(url) || options.method !== 'POST' || options.credentials !== 'same-origin') throw new Error('Invalid NLP transport');
 const { text, fallback } = JSON.parse(options.body);
 if (url.endsWith('/sentence')) {
  if (text !== 'HE L LO THERE' || fallback !== 'HE I LO THERE') throw new Error('Sentence request must preserve raw letters and provisional words');
  return Response.json({ original: text, engine: 'symspellpy', suggestions: [{ text: 'HELLO THERE', edits: 0, uncertain: false }] });
 }
 if (!/^[A-Z]+$/.test(text)) return Response.json({}, { status: 422 });
 return Response.json({ original: text, engine: 'symspellpy', suggestions: [{ text: 'HELLO', edits: 1, uncertain: false }] });
};
await import(${JSON.stringify(new URL(file, assets).href)});
parentPort.on('message', data => self.onmessage({ data }));`
const worker = new Worker(new URL(`data:text/javascript,${encodeURIComponent(source)}`))
try {
 const resultPromise = once(worker, 'message', { signal: AbortSignal.timeout(10000) })
 worker.postMessage({ id: 7, text: 'HXLLO', mode: 'automatic-word' })
 const [message] = await resultPromise
 assert.equal(message.id, 7)
 assert.equal(message.result.original, 'HXLLO')
 assert.equal(message.result.suggestions[0].text, 'HELLO')
 const errorPromise = once(worker, 'message', { signal: AbortSignal.timeout(10000) })
 worker.postMessage({ id: 8, text: '<invalid>' })
 const [invalid] = await errorPromise
 assert.equal(invalid.id, 8)
 assert.ok(invalid.error)
 const livePromise = once(worker, 'message', { signal: AbortSignal.timeout(10000) })
 worker.postMessage({ id: 9, text: 'HELL', mode: 'word' })
 const [live] = await livePromise
 assert.equal(live.id, 9)
 assert.equal(live.result.engine, 'symspellpy')
 const sentencePromise = once(worker, 'message', { signal: AbortSignal.timeout(10000) })
 worker.postMessage({ id: 10, mode: 'sentence', text: 'HE L LO THERE', fallback: 'HE I LO THERE' })
 const [sentence] = await sentencePromise
 assert.equal(sentence.id, 10)
 assert.equal(sentence.result.suggestions[0].text, 'HELLO THERE')
 console.log('PASS production worker transport, request IDs and backend failure handling')
} finally { await worker.terminate() }
