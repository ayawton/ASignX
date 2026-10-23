import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { loginAccount, observeSession } from '../src/login.js'

const user = { id: 'learner-id', email: 'learner@example.com', email_confirmed_at: '2026-10-23T00:00:00Z' }
const claims = Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${claims}.test-signature`
const stored = new Map()
const storage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) }
let mode = 'success', userChecks = 0, requests = 0, logouts = 0
function makeClient() { return createClient('https://login-test.supabase.co', 'sb_publishable_test', {
 auth: { storage, storageKey: 'asignx-login-test', persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
 global: { fetch: async (url, options) => {
  requests++
  const endpoint = new URL(url)
  if (endpoint.pathname === '/auth/v1/token') {
   assert.equal(endpoint.searchParams.get('grant_type'), 'password')
   const payload = JSON.parse(options.body)
   assert.equal(payload.email, 'learner@example.com')
   assert.equal(payload.password, '  correct password  ', 'Password whitespace is significant')
   assert.ok(!('role' in payload))
   if (mode === 'invalid') return Response.json({ code: 'invalid_credentials', msg: 'Internal provider message' }, { status: 400, headers: { 'X-Supabase-Api-Version': '2024-01-01' } })
   if (mode === 'unconfirmed') return Response.json({ code: 'email_not_confirmed', msg: 'Email not confirmed' }, { status: 400, headers: { 'X-Supabase-Api-Version': '2024-01-01' } })
   if (mode === 'limited') return Response.json({ code: 'over_request_rate_limit', msg: 'Limited' }, { status: 429, headers: { 'X-Supabase-Api-Version': '2024-01-01' } })
   return Response.json({ access_token: token, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, user })
  }
  if (endpoint.pathname === '/auth/v1/user') {
   userChecks++
   if (mode === 'revoked') return Response.json({ code: 'bad_jwt', msg: 'Bad token' }, { status: 401, headers: { 'X-Supabase-Api-Version': '2024-01-01' } })
   return Response.json(user)
  }
  if (endpoint.pathname === '/auth/v1/logout') { logouts++; return new Response(null, { status: 204 }) }
  assert.fail(`Unexpected endpoint: ${endpoint.pathname}`)
 } },
}) }
const values = { email: '  learner@example.com  ', password: '  correct password  ', role: 'admin' }
const client = makeClient()
const session = await loginAccount(client, values)
assert.equal(session.user.id, user.id)
assert.equal(userChecks, 1, 'Login verifies the identity with the auth server')
assert.ok(stored.has('asignx-login-test'))
assert.ok(!stored.get('asignx-login-test').includes(values.password), 'Passwords are never persisted')

const restored = makeClient(), states = []
const observer = observeSession(restored, state => states.push(state))
await observer.ready
assert.equal(states.at(-1).session.user.id, user.id)
assert.ok(userChecks >= 2, 'Restore rechecks stored credentials with Supabase')
await restored.auth.signOut({ scope: 'local' })
assert.equal(logouts, 1)
assert.equal(states.at(-1).session, null)
assert.equal(stored.has('asignx-login-test'), false)
observer.unsubscribe()
console.log('PASS verified SDK login, persistent restoration, password exclusion, and logout')

for (const [value, code, message] of [
 ['invalid', 'invalid_credentials', /Email or password is incorrect/],
 ['unconfirmed', 'email_not_confirmed', /Confirm your email/],
 ['limited', 'over_request_rate_limit', /Too many login attempts/],
]) {
 mode = value
 await assert.rejects(loginAccount(client, values), error => error.code === code && message.test(error.message))
}
const beforeInvalid = requests
await assert.rejects(loginAccount(client, { ...values, email: 'bad' }), /valid email/)
await assert.rejects(loginAccount(client, { ...values, password: '' }), /Enter your password/)
assert.equal(requests, beforeInvalid)
await assert.rejects(loginAccount(null, values), /temporarily unavailable/)
console.log('PASS incorrect credentials, unconfirmed email, rate limits, and input/configuration errors')

mode = 'success'
await loginAccount(client, values)
mode = 'revoked'
const invalidStates = []
const invalidObserver = observeSession(client, state => invalidStates.push(state))
await invalidObserver.ready
assert.equal(invalidStates.at(-1).session, null)
assert.ok(invalidStates.at(-1).error.includes('log in again'))
invalidObserver.unsubscribe()
console.log('PASS revoked persisted session is rejected')

let resolveRestore, callback
const raceStates = []
const raceClient = { auth: {
 onAuthStateChange: fn => { callback = fn; return { data: { subscription: { unsubscribe() {} } } } },
 getSession: () => new Promise(resolve => { resolveRestore = resolve }),
 getUser: () => assert.fail('A stale restore must not verify or revive a signed-out session'),
} }
const raceObserver = observeSession(raceClient, state => raceStates.push(state))
callback('SIGNED_OUT', null)
resolveRestore({ data: { session }, error: null })
await raceObserver.ready
assert.equal(raceStates.length, 1)
assert.equal(raceStates[0].session, null)
raceObserver.unsubscribe()
callback('SIGNED_IN', session)
assert.equal(raceStates.length, 1)
console.log('PASS logout/unmount cannot be overwritten by a slow session restore')

let cleared = false
await assert.rejects(loginAccount({ auth: {
 signInWithPassword: async () => ({ data: { session }, error: null }),
 getUser: async () => ({ data: { user: { ...user, email_confirmed_at: null } }, error: null }),
 signOut: async options => { assert.equal(options.scope, 'local'); cleared = true; return { error: null } },
} }, values), error => error.code === 'email_not_confirmed')
assert.equal(cleared, true)
console.log('PASS partial login is cleared when email verification is missing')
await client.auth.signOut({ scope: 'local' })
