import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import orderRoutes from './routes/orderRoutes.js';
import shipmentRoutes from './routes/shipmentRoutes.js';
import bolRoutes from './routes/bolRoutes.js';
import { errorHandler } from './middlewares/errorHandler.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/shipments', shipmentRoutes);
app.use('/api/bol', bolRoutes);

app.use(errorHandler);

const port = process.env.PORT || 8080;

import { pool } from './config/db.js';

app.listen(port, async () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${port}`);

  // Test DB connection
  try {
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    const res = await client.query('SELECT NOW()');
    console.log('Creating DB time check:', res.rows[0]);
    client.release();
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    // Optional: process.exit(1) if you want to crash on failure
  }
});
