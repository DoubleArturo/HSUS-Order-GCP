import { PoolClient } from 'pg';
import { pool } from '../config/db.js';
import { Shipment, ShipmentItem } from '../types/database.js';

export interface NewShipment {
  orderId: string;
  trackingNumber: string | null;
  carrier: string | null;
  shippedAt: string;
  items: ShipmentItem[];
}

export const insertShipment = async (payload: NewShipment, client?: PoolClient): Promise<Shipment> => {
  const db = client || pool;
  const result = await db.query<Shipment>(
    `INSERT INTO shipments (order_id, tracking_number, carrier, shipped_at, items)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, order_id, tracking_number, carrier, shipped_at, items, created_at`,
    [
      payload.orderId,
      payload.trackingNumber,
      payload.carrier,
      payload.shippedAt,
      JSON.stringify(payload.items),
    ],
  );

  return result.rows[0];
};

export interface ShippedQuantity {
  sku: string;
  qty: number;
}

export const getTotalShippedByOrder = async (orderId: string, client?: PoolClient): Promise<ShippedQuantity[]> => {
  const db = client || pool;
  const result = await db.query<{ items: ShipmentItem[] }>(
    `SELECT items
     FROM shipments
     WHERE order_id = $1`,
    [orderId],
  );

  const totals: Record<string, number> = {};

  for (const row of result.rows) {
    for (const item of row.items) {
      totals[item.sku] = (totals[item.sku] ?? 0) + item.qty;
    }
  }

  return Object.entries(totals).map(([sku, qty]) => ({ sku, qty }));
};

export const findByOrderId = async (orderId: string, client?: PoolClient): Promise<Shipment[]> => {
  const db = client || pool;
  const result = await db.query<Shipment>(
    'SELECT * FROM shipments WHERE order_id = $1',
    [orderId]
  );
  return result.rows;
};

export const deleteByOrderId = async (orderId: string, client?: PoolClient): Promise<void> => {
  const db = client || pool;
  await db.query('DELETE FROM shipments WHERE order_id = $1', [orderId]);
};
