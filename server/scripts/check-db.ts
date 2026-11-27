import { connection } from '../src/db/index.js';
import { applicationTables, achievementColumns } from '../src/db/tables.js';

try {
    const rows = await connection<{ table_name: string; rls_enabled: boolean }[]>`
        select c.relname as table_name, c.relrowsecurity as rls_enabled
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
    `;
    const missing = applicationTables.filter(name => !rows.some(row => row.table_name === name));
    const unprotected = rows.filter(row => applicationTables.includes(row.table_name as typeof applicationTables[number]) && !row.rls_enabled);
    const retiredTables = [
        'departments', 'subjects', 'user_achievements', 'model_versions', 'practice_attempts',
        'recognition_sessions', 'recognition_results', 'heart_practice_rounds',
        'heart_practice_questions', 'heart_practice_submissions',
    ];
    const legacy = rows.filter(row => retiredTables.includes(row.table_name)).map(row => row.table_name);
    const columns = await connection<{ column_name: string }[]>`select column_name from information_schema.columns where table_schema='public' and table_name='achievements'`;
    const missingAchievementColumns = achievementColumns.filter(name => !columns.some(column => column.column_name === name));
    console.log(JSON.stringify({ connected: true, missing, unprotected, legacy, missingAchievementColumns }, null, 2));
    if (missing.length || unprotected.length || legacy.length || missingAchievementColumns.length) process.exitCode = 1;
} catch (error) {
    // Never print credentials or a full connection URL in diagnostics.
    console.error('Database check failed. Verify DATABASE_URL in server/.env.', { code: (error as { code?: string }).code ?? 'UNKNOWN' });
    process.exitCode = 1;
} finally {
    await connection.end({ timeout: 2 });
}
