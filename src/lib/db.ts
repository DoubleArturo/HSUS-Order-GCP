import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

// Use pg.Pool if available, otherwise fallback (common in some ESM/CJS interop scenarios)
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
}

export const pool = new Pool({
    connectionString,
    max: 10,
    ssl: process.env.PGSSLMODE === 'disable' ? false : undefined,
});
