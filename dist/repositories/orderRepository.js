import { pool } from '../config/db.js';
export const findByOrderNumber = async (orderNumber, client) => {
    const db = client || pool;
    const result = await db.query(`SELECT id, order_number, source, status, customer_info, external_id, items, created_at, updated_at
     FROM orders
     WHERE order_number = $1`, [orderNumber]);
    return result.rows[0] ?? null;
};
export const updateStatus = async (orderId, status, client) => {
    const db = client || pool;
    await db.query(`UPDATE orders
     SET status = $1, updated_at = NOW()
     WHERE id = $2`, [status, orderId]);
};
export const findAll = async (client) => {
    const db = client || pool;
    const result = await db.query(`SELECT id, order_number, source, status, customer_info, external_id, items, created_at, updated_at
     FROM orders`);
    return result.rows;
};
export const findById = async (id, client) => {
    const db = client || pool;
    const result = await db.query(`SELECT id, order_number, source, status, created_at, updated_at FROM orders WHERE id = $1`, [id]);
    return result.rows[0] ?? null;
};
