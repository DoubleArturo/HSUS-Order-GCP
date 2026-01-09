import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();
const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});
async function verifyConnection() {
    try {
        console.log('Connecting to database...');
        const client = await pool.connect();
        console.log('Connection successful!');
        try {
            const res = await client.query('SELECT id FROM orders LIMIT 1');
            console.log('Query successful! Result:', res.rows);
        }
        finally {
            client.release();
        }
    }
    catch (err) {
        console.error('Connection failed:', err);
    }
    finally {
        await pool.end();
    }
}
verifyConnection();
