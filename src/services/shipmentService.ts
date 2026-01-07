import { AppError } from '../utils/errors.js';
import * as orderRepo from '../repositories/orderRepository.js';
import * as shipmentRepo from '../repositories/shipmentRepository.js';
import { OrderStatus, Shipment, ShipmentItem } from '../types/database.js';

export interface CreateShipmentInput {
  order_number: string;
  tracking_number?: string;
  carrier?: string;
  shipped_at: string;
  items: ShipmentItem[];
}

const validateQuantities = (
  orderedItems: { sku: string; qty: number }[],
  shippedTotals: Map<string, number>,
  incoming: ShipmentItem[],
): void => {
  const orderQtyMap = new Map<string, number>();
  for (const item of orderedItems) {
    orderQtyMap.set(item.sku, item.qty);
  }

  for (const item of incoming) {
    if (item.qty <= 0) {
      throw new AppError('Quantity must be greater than 0', 400, 'INVALID_QTY');
    }

    const orderedQty = orderQtyMap.get(item.sku);
    if (orderedQty === undefined) {
      throw new AppError(`SKU ${item.sku} not found in order`, 400, 'SKU_NOT_FOUND');
    }

    const alreadyShipped = shippedTotals.get(item.sku) ?? 0;
    const newTotal = alreadyShipped + item.qty;
    if (newTotal > orderedQty) {
      throw new AppError(
        `Shipped qty for ${item.sku} exceeds ordered quantity`,
        400,
        'QTY_EXCEEDS_LIMIT',
      );
    }
  }
};

export const createShipment = async (input: CreateShipmentInput): Promise<Shipment> => {
  const order = await orderRepo.findByOrderNumber(input.order_number);
  if (!order) {
    throw new AppError(`Order ${input.order_number} not found`, 400, 'ORDER_NOT_FOUND');
  }

  const shipped = await shipmentRepo.getTotalShippedByOrder(order.id);
  const shippedMap = new Map<string, number>();
  for (const entry of shipped) {
    shippedMap.set(entry.sku, entry.qty);
  }

  validateQuantities(order.items, shippedMap, input.items);

  const shipment = await shipmentRepo.insertShipment({
    orderId: order.id,
    trackingNumber: input.tracking_number ?? null,
    carrier: input.carrier ?? null,
    shippedAt: input.shipped_at,
    items: input.items,
  });

  if (order.status !== OrderStatus.SHIPPED) {
    await orderRepo.updateStatus(order.id, OrderStatus.PARTIALLY_SHIPPED);
  }

  return shipment;
};
