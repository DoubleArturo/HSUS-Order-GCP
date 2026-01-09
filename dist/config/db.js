import dotenv from 'dotenv';
import { Pool } from 'pg';
dotenv.config();
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
}
export const pool = new Pool({
    connectionString,
    max: 10,
    ssl: process.env.PGSSLMODE === 'disable' ? false : undefined,
});
