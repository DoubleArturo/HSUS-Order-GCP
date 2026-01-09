import { AppError } from '../utils/errors.js';
import * as orderRepo from '../repositories/orderRepository.js';
import * as shipmentRepo from '../repositories/shipmentRepository.js';
export const getOrderWithShipmentSummary = async (orderNumber) => {
    const order = await orderRepo.findByOrderNumber(orderNumber);
    if (!order) {
        throw new AppError(`Order ${orderNumber} not found`, 400, 'ORDER_NOT_FOUND');
    }
    const shipped = await shipmentRepo.getTotalShippedByOrder(order.id);
    const shippedMap = new Map();
    for (const entry of shipped) {
        shippedMap.set(entry.sku, entry.qty);
    }
    const items = order.items.map((item) => ({
        sku: item.sku,
        ordered_qty: item.qty,
        shipped_qty: shippedMap.get(item.sku) ?? 0,
    }));
    return { order, items };
};
