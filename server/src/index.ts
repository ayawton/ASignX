import express from 'express';
import { connection } from './db/index.js';
import { applicationTables } from './db/tables.js';
import { personal } from './personal.js';
const app = express();
const PORT = Number(process.env.PORT ?? 3000);
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.use('/api/me', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); }, personal);
app.get('/', (_req, res) => { res.send('Welcome to the ASignX API'); });
app.get('/api/courses', async (_req, res) => { res.json(await connection`select id, title, description from courses where is_published order by title`); });
// These three written introductions are guest practice, never account grades or XP.
app.post('/api/practice/check', (req, res) => {
    const answers: Record<string, number> = { '1': 1, '2': 0, '3': 2 };
    const expected = answers[String(req.body.lesson_id)];
    if (expected === undefined || !Number.isInteger(req.body.answer) || req.body.answer < 0 || req.body.answer > 2) { res.status(400).json({ error: 'Choose a practice answer.' }); return; }
    res.json({ correct: req.body.answer === expected });
});
app.get('/health/ready', async (_req, res) => {
    try {
        const rows = await connection<{ name: string; present: boolean }[]>`select name, to_regclass('public.' || name) is not null as present from unnest(${[...applicationTables]}::text[]) as name`;
        const ready = rows.every(row => row.present);
        res.status(ready ? 200 : 503).json({ ready });
    } catch { res.status(503).json({ ready: false }); }
});
app.use((_req, res) => { res.status(404).json({ error: 'Endpoint not found.' }); });
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error instanceof SyntaxError ? 400 : 503).json({ error: error instanceof SyntaxError ? 'Invalid request.' : 'Data service is temporarily unavailable.' });
});
const server = app.listen(PORT, () => { console.log(`Server is running at http://localhost:${PORT}`); });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => server.close(() => { void connection.end({ timeout: 2 }); }));
