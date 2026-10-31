import assert from 'node:assert/strict'
import test from 'node:test'
import express from 'express'
import { once } from 'node:events'
import { createRecognitionRouter } from '../dist/recognition.js'

test('NLP gateway validates input and forwards text with private server credentials', async () => {
 const original = process.env.RECOGNITION_INTERNAL_TOKEN
 process.env.RECOGNITION_INTERNAL_TOKEN = 'nlp-gateway-test-key'
 const forwarded = []
 const app = express()
 app.use(express.json({ limit: '16kb' }))
 app.use('/api/recognition', createRecognitionRouter(async (url, options) => {
  forwarded.push({ url, options })
  if (url.endsWith('/nlp/sentence')) return Response.json({ original: 'HE L LO THERE', engine: 'symspellpy', suggestions: [{ text: 'HELLO THERE', edits: 0 }] })
  return Response.json({ original: 'HXLLO', engine: 'symspellpy', suggestions: [{ text: 'HELLO', edits: 1 }] })
 }))
 const server = app.listen(0, '127.0.0.1')
 try {
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}/api/recognition/nlp/word`
  const invalid = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: '<script>' }) })
  assert.equal(invalid.status, 400); assert.equal(forwarded.length, 0)
  const response = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'HXLLO' }) })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.suggestions[0].text, 'HELLO')
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.ok(!JSON.stringify(body).includes('nlp-gateway-test-key'))
  assert.ok(forwarded[0].url.endsWith('/nlp/word'))
  assert.equal(forwarded[0].options.headers['X-Recognition-Key'], 'nlp-gateway-test-key')
  assert.equal(new TextDecoder().decode(forwarded[0].options.body), JSON.stringify({ text: 'HXLLO' }))
  const sentence = await fetch(base.replace('/word', '/sentence'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'HE L LO THERE', fallback: 'HE I LO THERE' }) })
  assert.equal(sentence.status, 200)
  assert.equal((await sentence.json()).suggestions[0].text, 'HELLO THERE')
  assert.equal(new TextDecoder().decode(forwarded[1].options.body), JSON.stringify({ text: 'HE L LO THERE', fallback: 'HE I LO THERE' }))
 } finally {
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  if (original === undefined) delete process.env.RECOGNITION_INTERNAL_TOKEN
  else process.env.RECOGNITION_INTERNAL_TOKEN = original
 }
})
