import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { registerAccount } from '../src/registration.js'

const values = { name: '  ASL learner  ', email: '  learner@example.com  ', password: 'a-long-test-password', confirmPassword: 'a-long-test-password', role: 'admin', xp: 9000 }
let requests = 0
const client = createClient('https://test-project.supabase.co', 'sb_publishable_test', {
 auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
 global: { fetch: async (url, options) => {
  requests++
  const endpoint = new URL(url)
  assert.equal(endpoint.pathname, '/auth/v1/signup')
  const payload = JSON.parse(options.body)
  assert.equal(payload.email, 'learner@example.com')
  assert.equal(payload.password, values.password)
  assert.deepEqual(payload.data, { display_name: 'ASL learner' })
  assert.ok(!('confirmPassword' in payload))
  const callback = new URL(endpoint.searchParams.get('redirect_to'))
  assert.equal(callback.origin, 'https://asignx.example')
  assert.equal(callback.pathname, '/auth/callback')
  assert.equal(callback.searchParams.get('next'), '/learn/courses')
  return Response.json({ id: 'account-id', email: payload.email, identities: [{ id: 'email-identity' }], user_metadata: payload.data })
 } },
})
const data = await registerAccount(client, values, 'https://asignx.example', '/learn/courses')
assert.equal(data.user.id, 'account-id')
assert.equal(data.session, null, 'Confirmation-required signup does not pretend the user is logged in')
assert.equal(requests, 1)
console.log('PASS signup through Supabase SDK: trimmed fields, learner metadata, confirmation redirect, no fake session')

for (const [change, message] of [
 [{ name: '   ' }, /display name/], [{ name: 'x'.repeat(101) }, /display name/],
 [{ email: 'invalid' }, /email address/], [{ password: 'short', confirmPassword: 'short' }, /at least 8/],
 [{ confirmPassword: 'different' }, /do not match/],
]) await assert.rejects(registerAccount(client, { ...values, ...change }, 'https://asignx.example', '/profile'), message)
assert.equal(requests, 1, 'Invalid details do not reach Supabase')
await assert.rejects(registerAccount(null, values, 'https://asignx.example', '/profile'), /temporarily unavailable/)
console.log('PASS validation and missing-configuration handling')

let called = false
const safeClient = { auth: { signUp: async payload => {
 called = true
 assert.equal(new URL(payload.options.emailRedirectTo).searchParams.get('next'), '/dashboard')
 return { data: { user: { id: 'account-id' }, session: null }, error: null }
} } }
await registerAccount(safeClient, values, 'https://asignx.example', '//untrusted.example')
assert.equal(called, true)
const rejected = new Error('Email rate limit exceeded')
await assert.rejects(registerAccount({ auth: { signUp: async () => ({ error: rejected }) } }, values, 'https://asignx.example', '/profile'), error => error === rejected)
await assert.rejects(registerAccount({ auth: { signUp: async () => ({ data: {}, error: null }) } }, values, 'https://asignx.example', '/profile'), /could not complete/)
console.log('PASS unsafe redirect rejection and Supabase failure propagation')
