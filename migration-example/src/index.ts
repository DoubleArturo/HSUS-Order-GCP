/**
 * Cloud Run 服務入口點
 * Express.js 應用程式
 */

import express from 'express';
import dotenv from 'dotenv';
import poRouter from '../api/po-service';

// 載入環境變數
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// 中間件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 健康檢查端點
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API 路由
app.use('/api/v1/po', poRouter);

// 錯誤處理中間件
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 啟動伺服器
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

