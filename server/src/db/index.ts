import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set. See server/.env.example.');

// Supabase transaction pooling requires prepared statements to be disabled.
export const connection = postgres(process.env.DATABASE_URL, { prepare: false, max: 5, connect_timeout: 10 });
export const db = drizzle({ client: connection });
