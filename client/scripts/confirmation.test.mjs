import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { confirmEmail, resendConfirmation, confirmationRedirect } from '../src/confirmation.js'

const confirmed = { id: 'learner', email_confirmed_at: '2026-10-23T00:00:00Z' }
let exchanges = 0, verified = 0
const client = { auth: {
 setSession: async tokens => { exchanges++; assert.deepEqual(tokens, { access_token: 'access', refresh_token: 'refresh' }); return { data: { session: { access_token: 'access' } }, error: null } },
 getUser: async token => { verified++; assert.equal(token, 'access'); return { data: { user: confirmed }, error: null } },
 // Reading an older session must never make an invalid confirmation succeed.
 getSession: async () => assert.fail('Confirmation must verify the link itself'),
} }
assert.equal((await confirmEmail(client, 'https://asignx.example/auth/callback#access_token=access&refresh_token=refresh&type=signup')).id, 'learner')
assert.equal(exchanges, 1); assert.equal(verified, 1)
for (const callback of [
 'https://asignx.example/auth/callback',
 'https://asignx.example/auth/callback#error=access_denied&error_code=otp_expired',
 'https://asignx.example/auth/callback?error=access_denied',
 'https://asignx.example/auth/callback#access_token=access&refresh_token=refresh&type=recovery',
]) await assert.rejects(confirmEmail(client, callback), /confirmation link|Open the confirmation link/)
assert.equal(exchanges, 1, 'Expired, missing and recovery links are not accepted as confirmation')
assert.equal(verified, 1)
console.log('PASS confirmation success, expired/missing links, and isolation from existing browser sessions')

const codeClient = { auth: {
 exchangeCodeForSession: async code => { assert.equal(code, 'one-time-code'); return { data: { session: { access_token: 'access' } }, error: null } },
 getUser: client.auth.getUser,
} }
await confirmEmail(codeClient, 'https://asignx.example/auth/callback?code=one-time-code')
const hashClient = { auth: {
 verifyOtp: async payload => { assert.deepEqual(payload, { token_hash: 'hashed-token', type: 'email' }); return { data: { session: { access_token: 'access' } }, error: null } },
 getUser: client.auth.getUser,
} }
await confirmEmail(hashClient, 'https://asignx.example/auth/callback?token_hash=hashed-token&type=email')
await assert.rejects(confirmEmail({ auth: { ...client.auth, getUser: async () => ({ data: { user: { id: 'learner' } }, error: null }) } }, 'https://asignx.example/auth/callback#access_token=access&refresh_token=refresh'), /has not been confirmed/)
await assert.rejects(confirmEmail({ auth: { setSession: async () => ({ error: { message: 'sensitive internal provider detail' } }) } }, 'https://asignx.example/auth/callback#access_token=access&refresh_token=refresh'), /could not be verified/)
console.log('PASS code/token-hash verification and rejection of unconfirmed/provider-failed results')

let sent = 0
const sdk = createClient('https://test-project.supabase.co', 'sb_publishable_test', {
 auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
 global: { fetch: async (url, options) => {
  sent++
  assert.equal(new URL(url).pathname, '/auth/v1/resend')
  assert.equal(new URL(url).searchParams.get('redirect_to'), 'https://asignx.example/auth/callback?next=%2Flearn%2Fcourses')
  const payload = JSON.parse(options.body)
  assert.equal(payload.email, 'learner@example.com'); assert.equal(payload.type, 'signup')
  return Response.json({})
 } },
})
await resendConfirmation(sdk, ' learner@example.com ', 'https://asignx.example', '/learn/courses')
await assert.rejects(resendConfirmation(sdk, 'invalid', 'https://asignx.example'), /valid email/)
assert.equal(sent, 1)
assert.equal(new URL(confirmationRedirect('https://asignx.example', '//untrusted.example')).searchParams.get('next'), '/profile')
console.log('PASS resend through Supabase SDK and safe internal return links')
