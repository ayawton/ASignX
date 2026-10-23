import assert from 'node:assert/strict';
import { before, after, beforeEach, afterEach, test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Disposable PostgreSQL engine; never reads .env or connects to the user's database.
const db = new PGlite();
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const u1 = uid(1), u2 = uid(2), c1 = uid(10), c2 = uid(11), l1 = uid(20), l2 = uid(21);
const sign = uid(30), otherSign = uid(31), exercise = uid(40), correct = uid(50), wrong = uid(51);
const enrollment = uid(60), model = uid(70), session = uid(80), badge = uid(90);
const scalar = async sql => Object.values((await db.query(sql)).rows[0])[0];
const attempt = (option = correct, claimed = false) => `INSERT INTO exercise_attempts
    (enrollment_id,exercise_id,selected_option_id,is_correct) VALUES ('${enrollment}','${exercise}','${option}',${claimed})`;
const complete = () => `UPDATE lesson_progress SET completed_at=now(),xp_earned=999 WHERE enrollment_id='${enrollment}'`;
const practice = (score = '.9', prediction = `'${sign}'`, time = 'now()') => `INSERT INTO practice_attempts
    (user_id,target_sign_id,predicted_sign_id,model_version_id,confidence,is_correct,attempted_at)
    VALUES ('${u1}','${sign}',${prediction},'${model}',${score},true,${time})`;
async function rejects(sql, pattern) {
    await db.exec('SAVEPOINT expected_failure');
    await assert.rejects(db.exec(sql), pattern);
    await db.exec('ROLLBACK TO SAVEPOINT expected_failure');
}
async function asUser(user = u1, role = 'authenticated') {
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [user]);
    await db.exec(`SET LOCAL ROLE ${role}`);
}

before(async () => {
    // Only the Supabase-managed prerequisites are stubbed in this local engine.
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
        CREATE SCHEMA auth;
        CREATE TABLE auth.users (id uuid PRIMARY KEY, raw_user_meta_data jsonb DEFAULT '{}', email_confirmed_at timestamptz);
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
        GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;`);
    for (const folder of (await readdir(new URL('../drizzle/', import.meta.url))).sort()) {
        const path = new URL(`../drizzle/${folder}/migration.sql`, import.meta.url);
        const sql = await readFile(path, 'utf8');
        await db.exec(`BEGIN; ${sql} COMMIT;`);
    }
    await db.exec(`INSERT INTO auth.users(id,raw_user_meta_data,email_confirmed_at) VALUES
        ('${u1}','{"display_name":"Learner one","role":"admin"}',now()),('${u2}','{"display_name":"Learner two"}',now());
        INSERT INTO courses(id,title,is_published) VALUES ('${c1}','Alphabet',true),('${c2}','Draft',false);
        INSERT INTO lessons(id,course_id,title,sort_order) VALUES
            ('${l1}','${c1}','Letter A',1),('${l2}','${c2}','Hidden lesson',1);
        INSERT INTO signs(id,gloss,meaning,is_published) VALUES
            ('${sign}','A','Letter A',true),('${otherSign}','B','Letter B',false);
        INSERT INTO lesson_signs VALUES ('${l1}','${sign}',1);
        INSERT INTO exercises(id,lesson_id,prompt,sort_order) VALUES ('${exercise}','${l1}','Choose A',1);
        INSERT INTO exercise_options(id,exercise_id,option_text,is_correct,sort_order) VALUES
            ('${correct}','${exercise}','A',true,1),('${wrong}','${exercise}','B',false,2);
        UPDATE lessons SET is_published=true WHERE id IN ('${l1}','${l2}');
        INSERT INTO enrollments(id,user_id,course_id) VALUES ('${enrollment}','${u1}','${c1}');
        INSERT INTO lesson_progress(enrollment_id,lesson_id) VALUES ('${enrollment}','${l1}');
        INSERT INTO model_versions(id,version,artifact_path) VALUES ('${model}','v1','models/v1.onnx');
        INSERT INTO recognition_sessions(id,user_id) VALUES ('${session}','${u1}');
        INSERT INTO achievements(id,code,name,description,metric,threshold) VALUES
            ('${badge}','FIRST','First lesson','Complete one lesson','completed_lessons',1);`);
});
after(async () => { await db.close(); });
beforeEach(async () => { await db.exec('BEGIN'); });
afterEach(async () => { await db.exec('ROLLBACK'); });

test('migration replaces both practice tables with exactly 16 RLS-protected application tables', async () => {
    const { rows } = await db.query("SELECT relname,relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND relkind='r'");
    assert.equal(rows.length, 16);
    assert.ok(rows.every(r => r.relrowsecurity));
    assert.ok(!rows.some(r => ['departments', 'subjects'].includes(r.relname)));
});
test('already-confirmed signup creates a learner profile and ignores requested admin metadata', async () => {
    assert.equal(await scalar(`SELECT role FROM profiles WHERE id='${u1}'`), 'learner');
});
test('profiles reject invalid timezones', async () => {
    await rejects(`UPDATE profiles SET timezone='Invalid/Zone' WHERE id='${u1}'`, /Invalid IANA timezone/);
});
test('anonymous readers see only published content, including the parent course', async () => {
    await asUser('', 'anon');
    assert.equal(await scalar('SELECT count(*)::int FROM courses'), 1);
    assert.equal(await scalar('SELECT count(*)::int FROM lessons'), 1);
    assert.equal(await scalar('SELECT count(*)::int FROM signs'), 1);
    assert.equal(await scalar('SELECT count(*)::int FROM exercises'), 1);
});
test('learners can read only their own progress, profile and Live history', async () => {
    await asUser(u2);
    assert.equal(await scalar('SELECT count(*)::int FROM profiles'), 1);
    assert.equal(await scalar('SELECT count(*)::int FROM enrollments'), 0);
    assert.equal(await scalar('SELECT count(*)::int FROM lesson_progress'), 0);
    assert.equal(await scalar('SELECT count(*)::int FROM recognition_sessions'), 0);
});
test('owner can edit allowed profile fields but cannot promote their role', async () => {
    await asUser();
    await db.exec(`UPDATE profiles SET display_name='Updated',timezone='Asia/Manila' WHERE id='${u1}'`);
    assert.equal(await scalar(`SELECT display_name FROM profiles WHERE id='${u1}'`), 'Updated');
    await rejects(`UPDATE profiles SET role='admin' WHERE id='${u1}'`, /permission denied/);
});
test('browser cannot read answer keys or model artifact paths or write trusted outcomes', async () => {
    await asUser();
    await rejects('SELECT * FROM exercise_options', /permission denied/);
    await rejects('SELECT * FROM model_versions', /permission denied/);
    await rejects(complete(), /permission denied/);
    await rejects(practice(), /permission denied/);
});
test('grading uses stored option correctness and verifies course membership', async () => {
    await db.exec(attempt(wrong, true));
    assert.equal(await scalar('SELECT is_correct FROM exercise_attempts'), false);
    await rejects(`INSERT INTO exercise_attempts(enrollment_id,exercise_id,selected_option_id,is_correct)
        VALUES ('${enrollment}','${exercise}','${uid(999)}',true)`, /Option does not belong/);
    await rejects(`INSERT INTO lesson_progress(enrollment_id,lesson_id) VALUES ('${enrollment}','${l2}')`, /does not belong/);
});
test('lesson cannot complete until every exercise has a correct submission', async () => {
    await db.exec(attempt(wrong));
    await rejects(complete(), /Each exercise must be answered correctly/);
});
test('completion awards configured XP once and freezes the reward', async () => {
    await db.exec(attempt());
    await db.exec(complete());
    assert.equal(await scalar('SELECT xp_earned FROM lesson_progress'), 10);
    await rejects(complete(), /immutable/);
    await rejects('DELETE FROM lesson_progress', /cannot be deleted/);
    await rejects(`INSERT INTO lesson_progress(enrollment_id,lesson_id) VALUES ('${enrollment}','${l1}')`, /duplicate key/);
});
test('in-progress rows never retain XP and completed timestamps must be valid', async () => {
    await db.exec('UPDATE lesson_progress SET xp_earned=999');
    assert.equal(await scalar('SELECT xp_earned FROM lesson_progress'), 0);
    await db.exec(attempt());
    await rejects("UPDATE lesson_progress SET completed_at='2000-01-01'", /violates check constraint/);
});
test('practice uses the immutable model threshold and rejects out-of-range scores', async () => {
    await db.exec(practice('.79'));
    assert.equal(await scalar('SELECT is_correct FROM practice_attempts'), false);
    await db.exec(practice('.95'));
    assert.equal(await scalar('SELECT count(*)::int FROM practice_attempts WHERE is_correct'), 1);
    await db.exec(practice('.99', 'NULL'));
    assert.equal(await scalar('SELECT count(*)::int FROM practice_attempts WHERE is_correct'), 1);
    await rejects(practice('1.1'), /violates check constraint/);
    await rejects("UPDATE model_versions SET confidence_threshold='.1'", /immutable/);
});
test('lesson practice requires target membership and enrollment', async () => {
    await rejects(`INSERT INTO practice_attempts(user_id,lesson_id,target_sign_id,model_version_id,confidence,is_correct)
        VALUES ('${u1}','${l1}','${otherSign}','${model}',.9,true)`, /requires enrollment/);
    await rejects(`INSERT INTO practice_attempts(user_id,lesson_id,target_sign_id,model_version_id,confidence,is_correct)
        VALUES ('${u2}','${l1}','${sign}','${model}',.9,true)`, /requires enrollment/);
});
test('published quiz definitions cannot be silently changed', async () => {
    await rejects(`UPDATE exercise_options SET option_text='Replaced' WHERE id='${correct}'`, /definitions are frozen/);
    await rejects(`UPDATE exercises SET prompt='Replaced' WHERE id='${exercise}'`, /definitions are frozen/);
});
test('publication rejects missing choices or no correct choice', async () => {
    await db.exec(`UPDATE lessons SET is_published=false WHERE id='${l2}';
        INSERT INTO exercises(lesson_id,prompt,sort_order) VALUES ('${l2}','Incomplete question',1);
        UPDATE lessons SET is_published=true WHERE id='${l2}'`);
    await rejects('SET CONSTRAINTS ALL IMMEDIATE', /at least two options/);
});
test('only one option per exercise can be correct', async () => {
    await db.exec(`UPDATE lessons SET is_published=false WHERE id='${l1}'`);
    await rejects(`UPDATE exercise_options SET is_correct=true WHERE id='${wrong}'`, /duplicate key/);
});
test('Live final text uses ordered, accepted predictions and rejects later appends', async () => {
    await db.exec(`INSERT INTO recognition_results(session_id,sign_id,model_version_id,sequence_no,confidence) VALUES
        ('${session}','${sign}','${model}',2,.9),('${session}','${otherSign}','${model}',1,.9),
        ('${session}','${sign}','${model}',3,.3),('${session}',NULL,'${model}',4,.99);
        UPDATE recognition_sessions SET ended_at=now(),final_text='Client fake text' WHERE id='${session}'`);
    assert.equal(await scalar('SELECT final_text FROM recognition_sessions'), 'Letter B Letter A');
    await rejects(`INSERT INTO recognition_results(session_id,model_version_id,sequence_no,confidence)
        VALUES ('${session}','${model}',5,.9)`, /ended recognition session/);
});
test('achievement awards require eligibility and cannot be duplicated or redefined', async () => {
    await rejects(`INSERT INTO user_achievements(user_id,achievement_id) VALUES ('${u1}','${badge}')`, /threshold has not been met/);
    await db.exec(attempt()); await db.exec(complete());
    await db.exec(`INSERT INTO user_achievements(user_id,achievement_id) VALUES ('${u1}','${badge}')`);
    await rejects(`INSERT INTO user_achievements(user_id,achievement_id) VALUES ('${u1}','${badge}')`, /duplicate key/);
    await rejects("UPDATE achievements SET threshold=2", /immutable/);
});
test('streak combines local dates, counts a date once and resets after a gap', async () => {
    await db.exec(practice()); await db.exec(practice());
    assert.equal(await scalar(`SELECT asignx_private.current_streak('${u1}')`), 1);
    await db.exec(practice('.9', `'${sign}'`, "now()-interval '1 day'"));
    await db.exec(practice('.9', `'${sign}'`, "now()-interval '3 days'"));
    assert.equal(await scalar(`SELECT asignx_private.current_streak('${u1}')`), 2);
    await db.exec('DELETE FROM practice_attempts');
    await db.exec(practice('.9', `'${sign}'`, "now()-interval '3 days'"));
    assert.equal(await scalar(`SELECT asignx_private.current_streak('${u1}')`), 0);
});
test('account deletion cascades private activity but preserves shared content', async () => {
    await db.exec(attempt()); await db.exec(complete()); await db.exec(practice());
    await db.exec(`DELETE FROM auth.users WHERE id='${u1}'`);
    for (const name of ['enrollments','lesson_progress','exercise_attempts','practice_attempts','recognition_sessions']) {
        assert.equal(await scalar(`SELECT count(*)::int FROM ${name}`), 0, name);
    }
    assert.equal(await scalar('SELECT count(*)::int FROM courses'), 2);
    assert.equal(await scalar('SELECT count(*)::int FROM model_versions'), 1);
});

test('legacy replacement guard handles absent tables and refuses populated tables', async () => {
    const migration = await readFile(new URL('../drizzle/20261021161839_asignx_application/migration.sql', import.meta.url), 'utf8');
    const guard = migration.split('--> statement-breakpoint')[0];
    await db.exec(guard);
    await db.exec('CREATE TABLE departments(id integer); INSERT INTO departments VALUES (1)');
    await rejects(guard, /Legacy departments\/subjects contain data/);
    await db.exec('DROP TABLE departments; CREATE TABLE subjects(id integer); INSERT INTO subjects VALUES (1)');
    await rejects(guard, /Legacy departments\/subjects contain data/);
    await db.exec('DELETE FROM subjects');
    await db.exec(guard);
});

test('pending signup creates no profile; verification creates exactly one learner profile', async () => {
    const pending = uid(300);
    await db.exec(`INSERT INTO auth.users(id,raw_user_meta_data) VALUES ('${pending}','{"display_name":"Pending learner","role":"admin"}')`);
    assert.equal(await scalar(`SELECT count(*)::int FROM profiles WHERE id='${pending}'`), 0);
    await rejects(`INSERT INTO profiles(id,display_name) VALUES ('${pending}','Bypass attempt')`, /Email must be confirmed/);
    await db.exec(`UPDATE auth.users SET raw_user_meta_data='{"display_name":"Updated pending name","role":"admin"}' WHERE id='${pending}'`);
    assert.equal(await scalar(`SELECT count(*)::int FROM profiles WHERE id='${pending}'`), 0);
    await db.exec(`UPDATE auth.users SET email_confirmed_at=now() WHERE id='${pending}'`);
    const { rows } = await db.query(`SELECT display_name,role FROM profiles WHERE id='${pending}'`);
    assert.deepEqual(rows, [{ display_name: 'Updated pending name', role: 'learner' }]);
    await db.exec(`UPDATE profiles SET display_name='Saved profile name',timezone='Asia/Manila' WHERE id='${pending}'; UPDATE auth.users SET email_confirmed_at=now() WHERE id='${pending}'`);
    assert.equal(await scalar(`SELECT count(*)::int FROM profiles WHERE id='${pending}'`), 1);
    assert.equal(await scalar(`SELECT display_name FROM profiles WHERE id='${pending}'`), 'Saved profile name');
    assert.equal(await scalar(`SELECT timezone FROM profiles WHERE id='${pending}'`), 'Asia/Manila');
});

test('pending signup can be deleted without ever creating a profile', async () => {
    const pending = uid(301);
    await db.exec(`INSERT INTO auth.users(id) VALUES ('${pending}'); DELETE FROM auth.users WHERE id='${pending}'`);
    assert.equal(await scalar(`SELECT count(*)::int FROM profiles WHERE id='${pending}'`), 0);
});

test('upgrade removes empty pending profiles, preserves confirmed profiles, and refuses to erase activity', async () => {
    const upgradeDb = new PGlite();
    try {
        await upgradeDb.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
            CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb DEFAULT '{}',email_confirmed_at timestamptz);
            CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
            GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
            GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;`);
        const folders = (await readdir(new URL('../drizzle/', import.meta.url))).sort();
        for (const folder of folders.filter(name => !name.endsWith('_confirmed_profiles'))) {
            await upgradeDb.exec(await readFile(new URL(`../drizzle/${folder}/migration.sql`, import.meta.url), 'utf8'));
        }
        const pending = uid(310), confirmed = uid(311), activePending = uid(312);
        await upgradeDb.exec(`INSERT INTO auth.users(id,email_confirmed_at) VALUES ('${pending}',null),('${confirmed}',now());
            UPDATE profiles SET display_name='Keep my profile',role='admin',timezone='Asia/Manila' WHERE id='${confirmed}'`);
        const migration = await readFile(new URL('../drizzle/20261022172738_confirmed_profiles/migration.sql', import.meta.url), 'utf8');
        await upgradeDb.exec(`BEGIN; INSERT INTO auth.users(id) VALUES ('${activePending}');
            INSERT INTO recognition_sessions(user_id) VALUES ('${activePending}'); SAVEPOINT before_migration;`);
        await assert.rejects(upgradeDb.exec(migration), /Unconfirmed profiles have saved activity/);
        await upgradeDb.exec('ROLLBACK TO SAVEPOINT before_migration');
        assert.equal((await upgradeDb.query(`SELECT count(*)::int AS n FROM recognition_sessions WHERE user_id='${activePending}'`)).rows[0].n, 1);
        await upgradeDb.exec('ROLLBACK');
        await upgradeDb.exec(`BEGIN; ${migration} COMMIT;`);
        assert.equal((await upgradeDb.query(`SELECT count(*)::int AS n FROM profiles WHERE id='${pending}'`)).rows[0].n, 0);
        assert.equal((await upgradeDb.query(`SELECT count(*)::int AS n FROM auth.users WHERE id='${pending}'`)).rows[0].n, 1);
        assert.deepEqual((await upgradeDb.query(`SELECT display_name,role,timezone FROM profiles WHERE id='${confirmed}'`)).rows,
            [{ display_name: 'Keep my profile', role: 'admin', timezone: 'Asia/Manila' }]);
        await upgradeDb.exec(`UPDATE auth.users SET email_confirmed_at=now() WHERE id='${pending}'`);
        assert.equal((await upgradeDb.query(`SELECT count(*)::int AS n FROM profiles WHERE id='${pending}'`)).rows[0].n, 1);
    } finally { await upgradeDb.close(); }
});
