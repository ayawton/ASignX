import { Router } from 'express';
import type { RequestHandler } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Sql } from 'postgres';
import { createGuestDatabase } from './db/guestDatabase.js';
import { guestConnection } from './db/learnerConnection.js';
import { closeLessonRecognitionForUser } from './lessonRecognition.js';

const idleMs = 60 * 60 * 1000;
const maxSessions = 100;
export function createGuestAccess(catalog: Sql) {
    const starts = new Map<string, { count: number; expires: number }>();
    const sessions = new Map<string, { id: string; expires: number }>();
    let pending = 0;
    let removing = 0;
    let store: ReturnType<typeof createGuestDatabase> | undefined;

    function getStore() {
        store ??= createGuestDatabase(catalog).catch(error => { store = undefined; throw error; });
        return store;
    }

    function tokenFrom(header: string | undefined) {
        return header?.match(/^Bearer (guest\.[A-Za-z0-9_-]{43})$/)?.[1];
    }

    async function removeGuest(token: string) {
        const session = sessions.get(token);
        if (!session) return;
        sessions.delete(token);
        removing++;
        try {
            const { database } = await getStore();
            await database.query('DELETE FROM auth.users WHERE id=$1', [session.id]);
            await closeLessonRecognitionForUser(session.id);
        } finally {
            removing--;
            if (!sessions.size && !pending && !removing) {
                const retired = store;
                store = undefined;
                await (await retired)?.database.close();
            }
        }
    }

    const expiry = setInterval(() => {
        const now = Date.now();
        for (const [token, session] of sessions) {
            if (session.expires <= now) void removeGuest(token).catch(() => {});
        }
        for (const [address, bucket] of starts) if (bucket.expires <= now) starts.delete(address);
    }, 60_000).unref();

    const guests = Router();
    guests.post('/', async (req, res) => {
        const address = req.ip ?? req.socket.remoteAddress ?? 'unknown';
        const now = Date.now();
        const previous = starts.get(address);
        const bucket = previous && previous.expires > now ? previous : { count: 0, expires: now + 60_000 };
        if (bucket.count >= 30 || sessions.size + pending + removing >= maxSessions || (!previous && starts.size >= 1000)) {
            res.status(429).json({ error: 'Guest sign-in is busy. Please try again shortly.' });
            return;
        }
        bucket.count++;
        starts.set(address, bucket);
        pending++;
        try {
            const { database } = await getStore();
            const id = randomUUID();
            const token = 'guest.' + randomBytes(32).toString('base64url');
            await database.query('INSERT INTO auth.users (id, is_anonymous) VALUES ($1, true)', [id]);
            sessions.set(token, { id, expires: Date.now() + idleMs });
            res.status(201).json({ token, user: { id, role: 'guest' } });
        } finally { pending--; }
    });
    guests.get('/session', (req, res) => {
        const token = tokenFrom(req.get('Authorization'));
        const session = token && sessions.get(token);
        if (!session || session.expires <= Date.now()) {
            res.status(401).json({ error: 'Your guest session ended.' });
            return;
        }
        session.expires = Date.now() + idleMs;
        res.json({ id: session.id, role: 'guest' });
    });
    guests.delete('/session', async (req, res) => {
        const token = tokenFrom(req.get('Authorization'));
        if (token) await removeGuest(token);
        res.status(204).end();
    });

    const useGuestSession: RequestHandler = async (req, res, next) => {
        const header = req.get('Authorization');
        if (!header?.startsWith('Bearer guest.')) { next(); return; }
        const token = tokenFrom(header);
        const session = token && sessions.get(token);
        if (!session || session.expires <= Date.now()) {
            res.status(401).json({ error: 'Your guest session ended. Open the guest link to start again.' });
            return;
        }
        session.expires = Date.now() + idleMs;
        const { sql } = await getStore();
        guestConnection.run({ id: session.id, sql }, next);
    };
    async function close() {
        clearInterval(expiry);
        const active = await store;
        await active?.database.close();
    }
    return { guests, useGuestSession, close };
}
