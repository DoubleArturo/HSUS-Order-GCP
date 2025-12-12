/**
 * Database Configuration
 * 使用 pg (node-postgres) 連線 Supabase PostgreSQL
 */

const { Pool } = require('pg');
require('dotenv').config();

// 建立連線池
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // 最大連線數
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 連線池事件監聽
pool.on('connect', () => {
  console.log('✅ Database connected');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(-1);
});

/**
 * 執行查詢（自動處理連線）
 * @param {string} text - SQL 查詢語句
 * @param {Array} params - 查詢參數
 * @returns {Promise} 查詢結果
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Query error:', { text, error: error.message });
    throw error;
  }
}

/**
 * 取得連線池（用於 Transaction）
 * @returns {Pool} PostgreSQL 連線池
 */
function getPool() {
  return pool;
}

/**
 * 關閉連線池
 */
async function closePool() {
  await pool.end();
}

module.exports = {
  query,
  getPool,
  closePool,
  pool, // 直接匯出 pool 以供進階使用
};

