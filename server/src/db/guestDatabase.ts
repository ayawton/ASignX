import { PGlite } from '@electric-sql/pglite';
import type { Sql } from 'postgres';
import { readFile, readdir } from 'node:fs/promises';

type Query = Pick<PGlite, 'query'>;
function tag(query: Query) {
    return async (parts: TemplateStringsArray, ...args: unknown[]) => {
        const statement = parts.reduce((sql, part, i) => sql + (i ? '$' + i : '') + part, '');
        return (await query.query(statement, args)).rows;
    };
}

async function initializeGuestSchema(database: PGlite) {
    await database.exec(`
        CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
        CREATE SCHEMA auth;
        CREATE TABLE auth.users (
            id uuid PRIMARY KEY, raw_user_meta_data jsonb DEFAULT '{}',
            email_confirmed_at timestamptz, is_anonymous boolean NOT NULL DEFAULT false
        );
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    `);
    const root = new URL('../../drizzle/', import.meta.url);
    for (const folder of (await readdir(root)).sort()) {
        await database.exec(await readFile(new URL(folder + '/migration.sql', root), 'utf8'));
    }
}

export async function createGuestTemplate() {
    const database = new PGlite();
    try {
        await initializeGuestSchema(database);
        return await database.dumpDataDir('gzip');
    } finally {
        await database.close();
    }
}

export async function createGuestDatabase(catalog: Sql) {
    const templatePath = process.env.ASIGNX_GUEST_TEMPLATE;
    const template = templatePath ? new Blob([await readFile(templatePath)]) : undefined;
    const database = new PGlite(template ? { loadDataDir: template } : {});
    try {
        if (!template) await initializeGuestSchema(database);
        const snapshot = await catalog.begin('isolation level repeatable read read only', async tx => ({
            courses: await tx`SELECT * FROM courses WHERE is_published`,
            signs: await tx`SELECT * FROM signs WHERE is_published`,
            lessons: await tx`SELECT l.* FROM lessons l JOIN courses c ON c.id=l.course_id WHERE l.is_published AND c.is_published`,
            lesson_signs: await tx`SELECT ls.* FROM lesson_signs ls JOIN lessons l ON l.id=ls.lesson_id
                JOIN courses c ON c.id=l.course_id JOIN signs s ON s.id=ls.sign_id WHERE l.is_published AND c.is_published AND s.is_published`,
            exercises: await tx`SELECT x.* FROM exercises x JOIN lessons l ON l.id=x.lesson_id
                JOIN courses c ON c.id=l.course_id WHERE l.is_published AND c.is_published`,
            exercise_options: await tx`SELECT o.* FROM exercise_options o JOIN exercises x ON x.id=o.exercise_id
                JOIN lessons l ON l.id=x.lesson_id JOIN courses c ON c.id=l.course_id WHERE l.is_published AND c.is_published`,
            achievements: await tx`SELECT * FROM achievements WHERE status='published'`,
        }));
        await database.transaction(async tx => {
            // The catalog already passed publication checks in the source transaction.
            // Load its graph as a snapshot, then restore all triggers before learner traffic.
            await tx.exec('SET LOCAL session_replication_role = replica');
            await tx.exec('DELETE FROM public.achievements');
            for (const [table, rows] of Object.entries(snapshot)) {
                await tx.query(`INSERT INTO public.${table} SELECT * FROM jsonb_populate_recordset(NULL::public.${table}, $1::jsonb)`,
                    [JSON.stringify(rows)]);
            }
        });
        const sql = Object.assign(tag(database), {
            json: (value: unknown) => JSON.stringify(value),
            begin: (callback: (tx: ReturnType<typeof tag>) => Promise<unknown>) =>
                database.transaction(tx => callback(tag(tx))),
        }) as unknown as Sql;
        return { database, sql };
    } catch (error) {
        await database.close();
        throw error;
    }
}
