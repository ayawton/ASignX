import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { configureProxyTrust } from '../dist/proxyTrust.js';

function clientAddress(trust, forwarded) {
    const app = express();
    configureProxyTrust(app, trust);
    // Exercise Express's real req.ip getter and compiled trust function directly.
    const req = Object.create(app.request);
    req.socket = { remoteAddress: '127.0.0.1' };
    req.headers = { 'x-forwarded-for': forwarded };
    return req.ip;
}
test('untrusted forwarded addresses cannot bypass rate-limit identity', () => {
    assert.equal(clientAddress(undefined, '198.51.100.7'), '127.0.0.1');
    assert.equal(clientAddress('192.0.2.0/24', '198.51.100.7'), '127.0.0.1');
});
test('verified proxies stop at the nearest untrusted address', () => {
    assert.equal(clientAddress('127.0.0.1/32', '203.0.113.99, 198.51.100.7'), '198.51.100.7');
});
test('hop counts, booleans, malformed networks and global trust fail startup', () => {
    for (const value of ['true', '1', '0.0.0.0/0', '::/0', '127.0.0.1/33', '::1/129', '10.0.0.1/24/1']) {
        assert.throws(() => configureProxyTrust(express(), value), /TRUST_PROXY_CIDRS/);
    }
});
