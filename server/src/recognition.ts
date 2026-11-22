import express, { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

// Public gateway only. Python and model files are never exposed as static assets.
export function createRecognitionRouter(fetcher: typeof fetch = fetch) {
    const router = Router();
    const starts = new Map<string, { count: number; expires: number }>();
    router.use((req: Request, res: Response, next: NextFunction) => {
        res.setHeader('Cache-Control', 'no-store');
        const origin = req.get('origin');
        if (origin) {
            const allowed = (process.env.RECOGNITION_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean);
            try { if (new URL(origin).host !== req.get('host') && !allowed.includes(origin)) { res.status(403).json({ error: 'Use recognition from this website.' }); return; } }
            catch { res.status(403).json({ error: 'Invalid origin.' }); return; }
        }
        if (!process.env.RECOGNITION_INTERNAL_TOKEN) { res.status(503).json({ error: 'Recognition service is not configured.' }); return; }
        next();
    });
    async function forward(req: Request, res: Response, path: string) {
        const headers: Record<string, string> = { 'X-Recognition-Key': process.env.RECOGNITION_INTERNAL_TOKEN! };
        let body: Uint8Array<ArrayBuffer> | undefined;
        if (path.endsWith('/frames')) {
            if (!Buffer.isBuffer(req.body) || !req.body.length) { res.status(400).json({ error: 'Send a JPEG camera frame.' }); return; }
            headers['Content-Type'] = 'image/jpeg';
            headers['X-Frame-Timestamp'] = req.get('x-frame-timestamp') ?? '';
            body = new Uint8Array(req.body);
        }
        if (path === '/nlp/word' || path === '/nlp/sentence') {
            headers['Content-Type'] = 'application/json';
            body = new Uint8Array(Buffer.from(JSON.stringify({ text: req.body.text, ...(path === '/nlp/sentence' ? { fallback: req.body.fallback } : {}) })));
        }
        try {
            const base = process.env.RECOGNITION_URL ?? 'http://127.0.0.1:8001';
            const response = await fetcher(`${base}${path}`, { method: req.method, headers, ...(body ? { body } : {}), signal: AbortSignal.timeout(12000), redirect: 'error' });
            if (response.status === 204) { res.status(204).end(); return; }
            const data = await response.json() as Record<string, unknown>;
            if (!response.ok) {
                const status = [400, 404, 410, 413, 415, 422, 429].includes(response.status) ? response.status : 503;
                res.status(status).json({ error: status === 503 ? 'Recognition is unavailable. Try again shortly.' : typeof data.detail === 'string' ? data.detail : 'Unable to process the camera frame.' });
                return;
            }
            res.json(data);
        } catch { res.status(503).json({ error: 'Recognition is unavailable. Start the recognition service and try again.' }); }
    }
    router.post('/nlp/sentence', express.json({ limit: '8kb' }), (req, res) => {
        if (typeof req.body?.text !== 'string' || req.body.text.length > 2000 || !/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(req.body.text) || typeof req.body.fallback !== 'string' || req.body.fallback.length > 4000 || !/^[A-Z]+(?:[' ][A-Z]+)*$/.test(req.body.fallback)) { res.status(400).json({ error: 'Send valid sentence letters and provisional words.' }); return; }
        return forward(req, res, '/nlp/sentence');
    });
    router.post('/nlp/word', express.json({ limit: '2kb' }), (req, res) => {
        if (typeof req.body?.text !== 'string' || !/^[A-Za-z]{1,200}$/.test(req.body.text)) { res.status(400).json({ error: 'Send 1 to 200 English letters.' }); return; }
        return forward(req, res, '/nlp/word');
    });
    router.post('/sessions', (req, res) => {
        const now = Date.now();
        for (const [key, value] of starts) if (value.expires < now) starts.delete(key);
        const key = req.ip ?? 'unknown';
        const current = starts.get(key) ?? { count: 0, expires: now + 60000 };
        if (current.count >= 6 || starts.size >= 1024) { res.status(429).json({ error: 'Too many recognition starts. Try again in a minute.' }); return; }
        current.count++; starts.set(key, current);
        return forward(req, res, '/sessions');
    });
    router.use('/sessions/:id', (req, res, next) => {
        if (!/^[A-Za-z0-9_-]{43}$/.test(String(req.params.id))) { res.status(400).json({ error: 'Invalid recognition session.' }); return; }
        next();
    });
    router.post('/sessions/:id/frames', (req, res, next) => {
        if (!req.is('image/jpeg')) { res.status(415).json({ error: 'Send an image/jpeg camera frame.' }); return; }
        next();
    }, express.raw({ type: 'image/jpeg', limit: '256kb' }), (req, res) => forward(req, res, `/sessions/${req.params.id}/frames`));
    router.post('/sessions/:id/reset', (req, res) => forward(req, res, `/sessions/${req.params.id}/reset`));
    router.delete('/sessions/:id', (req, res) => forward(req, res, `/sessions/${req.params.id}`));
    router.use((error: { type?: string }, _req: Request, res: Response, _next: NextFunction) => {
        res.status(error.type === 'entity.too.large' ? 413 : 400).json({ error: error.type === 'entity.too.large' ? 'Camera frame is too large.' : 'Invalid camera frame.' });
    });
    return router;
}
