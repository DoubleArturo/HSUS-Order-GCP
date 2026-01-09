import { pool } from '../config/db.js';
export const insertShipment = async (payload, client) => {
    const db = client || pool;
    const result = await db.query(`INSERT INTO shipments (order_id, tracking_number, carrier, shipped_at, items)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, order_id, tracking_number, carrier, shipped_at, items, created_at`, [
        payload.orderId,
        payload.trackingNumber,
        payload.carrier,
        payload.shippedAt,
        JSON.stringify(payload.items),
    ]);
    return result.rows[0];
};
export const getTotalShippedByOrder = async (orderId, client) => {
    const db = client || pool;
    const result = await db.query(`SELECT items
     FROM shipments
     WHERE order_id = $1`, [orderId]);
    const totals = {};
    for (const row of result.rows) {
        for (const item of row.items) {
            totals[item.sku] = (totals[item.sku] ?? 0) + item.qty;
        }
    }
    return Object.entries(totals).map(([sku, qty]) => ({ sku, qty }));
};
export const findByOrderId = async (orderId, client) => {
    const db = client || pool;
    const result = await db.query('SELECT * FROM shipments WHERE order_id = $1', [orderId]);
    return result.rows;
};
export const deleteByOrderId = async (orderId, client) => {
    const db = client || pool;
    await db.query('DELETE FROM shipments WHERE order_id = $1', [orderId]);
};
