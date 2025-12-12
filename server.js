/**
 * Server Entry Point
 * Express.js 應用程式主程式
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bolController = require('./src/controllers/BolController');
const { closePool } = require('./src/config/database');

const app = express();
const PORT = process.env.PORT || 8080;

// ===== 中間件設定 =====
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== 請求日誌中間件 =====
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// ===== 健康檢查端點 =====
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'bol-entry-service',
  });
});

// ===== API 路由 =====

// GET /api/pos - 搜尋訂單
app.get('/api/pos', (req, res) => bolController.searchPurchaseOrders(req, res));

// GET /api/pos/:po_id/bols - 取得某張 PO 的 BOL 出貨紀錄
app.get('/api/pos/:po_id/bols', (req, res) => bolController.getBolsByPoId(req, res));

// POST /api/bols - 批次建立 BOL 出貨紀錄（核心功能，使用 Transaction）
app.post('/api/bols', (req, res) => bolController.createBols(req, res));

// DELETE /api/bols/:id - 刪除單筆 BOL 出貨紀錄
app.delete('/api/bols/:id', (req, res) => bolController.deleteBol(req, res));

// GET /api/bols/statistics - 取得統計資訊（額外功能）
app.get('/api/bols/statistics', (req, res) => bolController.getStatistics(req, res));

// ===== 404 處理 =====
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
  });
});

// ===== 錯誤處理中間件 =====
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ===== 啟動伺服器 =====
const server = app.listen(PORT, () => {
  console.log(`🚀 BOL Entry Service is running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

// ===== Graceful Shutdown =====
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(async () => {
    console.log('HTTP server closed');
    await closePool();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(async () => {
    console.log('HTTP server closed');
    await closePool();
    process.exit(0);
  });
});

module.exports = app;

