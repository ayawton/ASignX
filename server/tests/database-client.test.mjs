import assert from 'node:assert/strict';
import { test } from 'node:test';

test('runtime database client encodes JSON and timestamps before binding raw SQL parameters', async () => {
    // The client is lazy. Use an unreachable loopback URL and never execute a query.
    // This exercises the actual runtime initialization, not the test SQL mocks.
    const savedUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgres://codec_test:unused@127.0.0.1:1/codec_test';
    const { connection } = await import('../dist/db/index.js');
    try {
        const recipe = { version: 1, border: 'double', pattern: 'solid', decoration: 'none', finish: 'classic' };
        for (const type of [114, 3802]) {
            const encoded = connection.options.serializers[type](recipe);
            assert.equal(typeof encoded, 'string', 'JSON parameters must be serialized before the driver builds its wire message');
            assert.deepEqual(JSON.parse(encoded), recipe);
        }
        const timestamp = new Date('2026-11-27T00:00:00.000Z');
        assert.equal(connection.options.serializers[1184](timestamp), timestamp.toISOString());
    } finally {
        await connection.end({ timeout: 1 });
        if (savedUrl === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = savedUrl;
    }
});
