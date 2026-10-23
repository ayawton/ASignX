import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authenticate } from '../dist/personal.js';
function response() { return { locals: {}, code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }
test('backend verifies identity with Supabase and fails closed', async () => {
 const previous = globalThis.fetch;
 const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_PUBLISHABLE_KEY;
 try {
  process.env.SUPABASE_URL = 'https://example.supabase.co'; process.env.SUPABASE_PUBLISHABLE_KEY = 'public-test-key';
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error('must not reach auth without token'); };
  const absent = response(); await authenticate({ headers: {} }, absent, () => assert.fail('unauthenticated'));
  assert.equal(absent.code, 401); assert.equal(called, false);
  globalThis.fetch = async () => new Response('{}', { status: 401 });
  const invalid = response(); await authenticate({ headers: { authorization: 'Bearer forged' } }, invalid, () => assert.fail('forged'));
  assert.equal(invalid.code, 401);
  globalThis.fetch = async () => Response.json({ id: 'verified-user', email: 'learner@example.com' });
  const unconfirmed = response(); await authenticate({ headers: { authorization: 'Bearer token' } }, unconfirmed, () => assert.fail('unconfirmed'));
  assert.equal(unconfirmed.code, 401);
  globalThis.fetch = async (url, options) => { assert.equal(url, 'https://example.supabase.co/auth/v1/user'); assert.equal(options.headers.Authorization, 'Bearer valid'); return Response.json({ id: 'verified-user', email_confirmed_at: new Date().toISOString() }); };
  const valid = response(); let next = false;
  await authenticate({ headers: { authorization: 'Bearer valid' }, body: { user_id: 'victim' } }, valid, () => { next = true; });
  assert.equal(next, true); assert.equal(valid.locals.user.id, 'verified-user');
  delete process.env.SUPABASE_URL;
  const missing = response(); await authenticate({ headers: { authorization: 'Bearer valid' } }, missing, () => assert.fail('missing configuration'));
  assert.equal(missing.code, 503);
 } finally { globalThis.fetch = previous; if (url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = url; if (key === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = key; }
});
