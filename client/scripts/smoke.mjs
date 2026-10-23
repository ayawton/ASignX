import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'
const store = new Map()
globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) }
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
 const { default: App } = await vite.ssrLoadModule('/src/App.jsx')
 const { AuthProvider, internalPath } = await vite.ssrLoadModule('/src/auth.jsx')
 const render = path => renderToString(h(MemoryRouter, { initialEntries: [path] }, h(AuthProvider, null, h(App))))
 for (const [path, text] of [['/', 'Connection'], ['/learn', 'Your learning studio'], ['/learn/courses', 'Published account courses'], ['/live', 'Room for a conversation'], ['/login', 'Hello again'], ['/register', 'Start something good'], ['/auth/callback', 'Confirming your email'], ['/forgot-password', 'Forgot password?'], ['/reset-password', 'A fresh start'], ['/about', 'Understanding'], ['/learn/lesson/1', 'Meet the letter A'], ['/missing', 'Let’s find your way']]) {
  const html = render(path)
  assert.ok(html.includes(text), `${path}: expected content`)
  assert.equal((html.match(/<main/g) || []).length, 1)
  assert.equal((html.match(/<h1/g) || []).length, 1)
  console.log(`PASS public route ${path}`)
 }
 assert.ok(!render('/profile').includes('Make yourself at home'), 'Guest profile is protected')
 assert.ok(!render('/progress').includes('Verified XP'), 'Guest progress is protected')
 for (const unsafe of ['https://evil.example', '//evil.example', '/\\evil.example', '/login', '/auth/callback', '/\n/evil']) assert.equal(internalPath(unsafe), '/profile')
 assert.equal(internalPath('/learn/courses?filter=available'), '/learn/courses?filter=available')
 const { completeLesson, loadProgress, lessons } = await vite.ssrLoadModule('/src/data/learning.js')
 store.set('asignx-progress', '[1,2,3]')
 assert.deepEqual(loadProgress(), [], 'Legacy progress is not an account record')
 completeLesson(1); completeLesson(1); completeLesson(2)
 assert.deepEqual(loadProgress(), [1, 2])
 assert.ok(Object.values(lessons).every(lesson => !('correct' in lesson)), 'No answer keys shipped')
 store.set('asignx-guest-practice', '{broken')
 assert.deepEqual(loadProgress(), [])
 console.log('PASS personal route guards, internal redirects, isolated guest practice, and answer-key exclusion')
} finally { await vite.close() }

