import { connection } from '../src/db/index.js';
import { applicationTables } from '../src/db/tables.js';

try {
    const rows = await connection<{ table_name: string; rls_enabled: boolean }[]>`
        select c.relname as table_name, c.relrowsecurity as rls_enabled
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
    `;
    const missing = applicationTables.filter(name => !rows.some(row => row.table_name === name));
    const unprotected = rows.filter(row => applicationTables.includes(row.table_name as typeof applicationTables[number]) && !row.rls_enabled);
    const legacy = rows.filter(row => ['departments', 'subjects'].includes(row.table_name)).map(row => row.table_name);
    console.log(JSON.stringify({ connected: true, missing, unprotected, legacy }, null, 2));
    if (missing.length || unprotected.length || legacy.length) process.exitCode = 1;
} catch (error) {
    // Never print credentials or a full connection URL in diagnostics.
    console.error('Database check failed. Verify DATABASE_URL in server/.env.', { code: (error as { code?: string }).code ?? 'UNKNOWN' });
    process.exitCode = 1;
} finally {
    await connection.end({ timeout: 2 });
}
