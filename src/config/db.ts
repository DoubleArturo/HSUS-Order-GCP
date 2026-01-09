import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

// 1. 嘗試從環境變數組裝連線字串 (支援 Supabase Transaction Mode)
const buildConnectionString = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || '5432';
  const dbName = process.env.DB_NAME || 'postgres';

  if (!user || !host || !password) {
    throw new Error('Database configuration error: Missing DB_USER, DB_HOST, or DB_PASSWORD.');
  }

  // 格式: postgres://user:password@host:port/dbname
  return `postgres://${user}:${password}@${host}:${port}/${dbName}`;
};

const connectionString = buildConnectionString();

console.log(`Connecting to database at ${process.env.DB_HOST}:${process.env.DB_PORT}...`); // Debug log

// src/config/database.ts (或 database.js)

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // 如果 .env 讀不到，請確保這裡有 fallback 邏輯，但目前看起來連線字串是對的

  max: 10, // 連線池上限
  connectionTimeoutMillis: 5000, // 5秒連不上就報錯

  // 關鍵修正：強制信任 Supabase 的憑證
  ssl: {
    rejectUnauthorized: false
  }
});

// 測試連線 (Optional, 幫助 Debug)
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});