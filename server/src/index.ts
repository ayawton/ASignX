import express from 'express';
import { connection } from './db/index.js';
import { applicationTables, achievementColumns } from './db/tables.js';
import { personal } from './personal.js';
import { createGuestAccess } from './guests.js';
import { admin } from './admin.js';
import { createRecognitionRouter } from './recognition.js';
import { recognitionCapabilities } from './recognitionTransport.js';
import { configureProxyTrust } from './proxyTrust.js';
const app = express();
const { guests, useGuestSession, close: closeGuests } = createGuestAccess(connection);
configureProxyTrust(app, process.env.TRUST_PROXY_CIDRS);
const PORT = Number(process.env.PORT ?? 3000);
app.disable('x-powered-by');
// Include writes so grading latency can be separated from session verification.
app.use('/api', (req,res,next)=>{
 res.setHeader('Cache-Control', 'no-store');
 const started=performance.now(), json=res.json.bind(res);
 res.json=(body)=>{
  const total=performance.now()-started, auth=Number(res.locals.authDuration ?? 0);
  res.setHeader('Server-Timing', `auth;dur=${auth.toFixed(1)}, app;dur=${Math.max(0,total-auth).toFixed(1)}, total;dur=${total.toFixed(1)}`);
  return json(body);
 };
 next();
});
app.use('/api/admin', express.json({ limit: '256kb' }));
app.use(express.json({ limit: '16kb' }));
app.use('/api/recognition', createRecognitionRouter());
app.use('/api/admin', admin);
app.use('/api/guest', guests);
app.use('/api/me', useGuestSession, personal);
app.get('/', (_req, res) => { res.send('Welcome to the ASignX API'); });
app.get('/api/courses', async (_req, res) => { res.json(await connection`select id, title, description, cover_text, cover_size, cover_angle, cover_density, cover_weight, cover_font, cover_style, cover_tone from courses where is_published order by title`); });
// These three written introductions are guest practice, never account grades or XP.
app.post('/api/practice/check', (req, res) => {
    const answers: Record<string, number> = { '1': 1, '2': 0, '3': 2 };
    const expected = answers[String(req.body.lesson_id)];
    if (expected === undefined || !Number.isInteger(req.body.answer) || req.body.answer < 0 || req.body.answer > 2) { res.status(400).json({ error: 'Choose a practice answer.' }); return; }
    res.json({ correct: req.body.answer === expected });
});
app.get('/health/ready', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
        const rows = await connection<{ name: string; present: boolean }[]>`select name, to_regclass('public.' || name) is not null as present from unnest(${[...applicationTables]}::text[]) as name`;
        const columns = await connection<{ column_name: string }[]>`select column_name from information_schema.columns where table_schema='public' and table_name='achievements'`;
        const ready = rows.every(row => row.present) && achievementColumns.every(name => columns.some(column => column.column_name === name));
        res.status(ready ? 200 : 503).json({ ready });
    } catch { res.status(503).json({ ready: false }); }
});
app.get('/health/recognition', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try { await recognitionCapabilities(); res.json({ ready: true }); }
    catch { res.status(503).json({ ready: false }); }
});
app.use((_req, res) => { res.status(404).json({ error: 'Endpoint not found.' }); });
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error instanceof SyntaxError ? 400 : 503).json({ error: error instanceof SyntaxError ? 'Invalid request.' : 'Data service is temporarily unavailable.' });
});
const server = app.listen(PORT, () => { console.log(`Server is running at http://localhost:${PORT}`); });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => server.close(() => {
    void Promise.allSettled([closeGuests(), connection.end({ timeout: 2 })]);
}));
