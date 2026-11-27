import 'dotenv/config';
import postgres from 'postgres';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set. See server/.env.example.');

const databaseCa = process.env.DATABASE_CA_CERT?.replace(/\\n/g, '\n');
const requireVerifiedTls = process.env.NODE_ENV === 'production' || Boolean(databaseCa);

// Supabase transaction pooling requires prepared statements to be disabled.
// Production always verifies TLS certificates; supply Supabase's public CA
// through DATABASE_CA_CERT when it is not trusted by the runtime's root store.
export const connection = postgres(process.env.DATABASE_URL, {
    prepare: false,
    max: 5,
    connect_timeout: 10,
    ...(requireVerifiedTls ? { ssl: { rejectUnauthorized: true, ...(databaseCa ? { ca: databaseCa } : {}) } } : {}),
});
// Runtime routes use tagged SQL and postgres.js JSON/date codecs.
// Drizzle is used separately for schema definitions and migration tooling.
