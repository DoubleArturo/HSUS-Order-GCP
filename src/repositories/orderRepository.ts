import { pool } from '../config/db.js';
import { Order, OrderStatus } from '../types/database.js';

export const findByOrderNumber = async (
  orderNumber: string,
): Promise<Order | null> => {
  const result = await pool.query<Order>(
    `SELECT id, order_number, source, status, customer_info, external_id, items, created_at, updated_at
     FROM orders
     WHERE order_number = $1`,
    [orderNumber],
  );

  return result.rows[0] ?? null;
};

export const updateStatus = async (
  orderId: string,
  status: OrderStatus,
): Promise<void> => {
  await pool.query(
    `UPDATE orders
     SET status = $1, updated_at = NOW()
     WHERE id = $2`,
    [status, orderId],
  );
};
