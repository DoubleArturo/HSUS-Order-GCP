import { pool } from '../lib/db.js';

interface Order {
    id: string;
    order_number: string;
    source: string;
    status: string;
    created_at: Date;
    updated_at: Date;
}

interface Shipment {
    tracking_number: string;
    shipped_at: Date;
    items: any; // JSONB
    carrier?: string;
}

interface BolDataPayload {
    success: boolean;
    pendingList: { key: string; display: string }[];
    fulfilledList: { key: string; display: string }[];
    message?: string;
}

export class BolService {

    /**
     * [V13.0] Fetches initial BOL data directly from the 'orders' table.
     */
    static async getInitialBolData(): Promise<string> {
        try {
            // console.log('--- Starting getInitialBolData() [V13.0 - Direct SQL] ---');
            const result = await pool.query<Order>('SELECT * FROM orders');
            const orders = result.rows;

            const pendingList: { key: string; display: string }[] = [];
            const fulfilledList: { key: string; display: string; timestamp: string }[] = [];

            orders.forEach(order => {
                const key = order.order_number;
                const display = `${key} (${order.status})`;
                const timestamp = order.created_at.toISOString();

                const isFulfilled = ['SHIPPED', 'COMPLETED'].includes(order.status);

                if (isFulfilled) {
                    fulfilledList.push({ key, display, timestamp });
                } else {
                    pendingList.push({ key, display });
                }
            });

            fulfilledList.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
            pendingList.sort((a, b) => a.display.localeCompare(b.display));

            const payload: BolDataPayload = {
                success: true,
                pendingList,
                fulfilledList: fulfilledList.map(({ key, display }) => ({ key, display })),
            };

            return JSON.stringify(payload);

        } catch (e: any) {
            console.error(`[ERROR] getInitialBolData FAILED: ${e.message}`);
            return JSON.stringify({ success: false, message: `getInitialBolData Error: ${e.message}` });
        }
    }

    /**
     * [V13.0] Fetches existing BOL data for a given order number.
     */
    static async getExistingBolData(poSkuKey: string) {
        try {
            // console.log(`--- Starting getExistingBolData(${poSkuKey}) [V13.0 - Direct SQL] ---`);

            // 1. Get Order ID
            const orderRes = await pool.query('SELECT id, status FROM orders WHERE order_number = $1', [poSkuKey]);
            if (orderRes.rows.length === 0) {
                return { success: true, bols: [], actShipDate: null, isFulfilled: false };
            }
            const order = orderRes.rows[0];

            // 2. Get Shipments
            const shipmentRes = await pool.query<Shipment>('SELECT * FROM shipments WHERE order_id = $1', [order.id]);
            const shipments = shipmentRes.rows;

            // 3. Map Data
            let actShipDate: string | null = null;
            const isFulfilled = ['SHIPPED', 'COMPLETED'].includes(order.status);

            const bols = shipments.map(s => {
                if (!actShipDate && s.shipped_at) {
                    actShipDate = s.shipped_at.toISOString().split('T')[0];
                }

                let qty = 0;
                if (Array.isArray(s.items)) {
                    qty = s.items.reduce((acc: number, item: any) => acc + (Number(item.qty) || 0), 0);
                }

                return {
                    bolNumber: s.tracking_number,
                    shippedQty: qty,
                    shippingFee: 0,
                    signed: false
                };
            });

            return {
                success: true,
                bols,
                actShipDate,
                isFulfilled
            };

        } catch (e: any) {
            console.error(`[ERROR] getExistingBolData FAILED: ${e.message}`);
            return { success: false, message: e.toString() };
        }
    }

    /**
     * [V13.0] Saves BOL data using a transaction.
     * Replaces all existing shipments for the order with the new list.
     */
    static async saveBolData(data: any) {
        const client = await pool.connect();
        try {
            // console.log(`--- Starting saveBolData for ${data.poSkuKey} ---`);
            await client.query('BEGIN');

            const { poSkuKey, actShipDate, isFulfilled, bols } = data;

            // 1. Get Order ID
            const orderRes = await client.query('SELECT id FROM orders WHERE order_number = $1', [poSkuKey]);
            if (orderRes.rows.length === 0) {
                throw new Error(`Order not found: ${poSkuKey}`);
            }
            const orderId = orderRes.rows[0].id;

            // 2. Delete existing shipments
            await client.query('DELETE FROM shipments WHERE order_id = $1', [orderId]);

            // 3. Insert new shipments
            if (Array.isArray(bols)) {
                for (const bol of bols) {
                    const shippedAt = new Date(actShipDate);
                    const items = JSON.stringify([{ qty: parseInt(bol.shippedQty, 10) || 0 }]);

                    if (bol.bolNumber) {
                        await client.query(
                            `INSERT INTO shipments (order_id, tracking_number, shipped_at, items)
                             VALUES ($1, $2, $3, $4)`,
                            [orderId, bol.bolNumber, shippedAt, items]
                        );
                    }
                }
            }

            // 4. Update Order Status
            const newStatus = isFulfilled ? 'SHIPPED' : 'CONFIRMED'; // Fallback to CONFIRMED if un-fulfilling
            // Only update if not already COMPLETED? Or force update? 
            // For now, force update to reflect tool action.
            await client.query(
                `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`,
                [newStatus, orderId]
            );

            await client.query('COMMIT');
            return { success: true, message: `Successfully saved for '${poSkuKey}'.` };

        } catch (e: any) {
            await client.query('ROLLBACK');
            console.error(`[ERROR] saveBolData FAILED: ${e.message}`);
            return { success: false, message: e.toString() };
        } finally {
            client.release();
        }
    }
}
