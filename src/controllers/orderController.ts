import { Request, Response, NextFunction } from 'express';
import { ok } from '../utils/responses.js';
import * as orderService from '../services/orderService.js';

export const getOrderByNumber = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { order_number } = req.params;
    const { order, items } = await orderService.getOrderWithShipmentSummary(order_number);
    ok(res, {
      id: order.id,
      order_number: order.order_number,
      customer_info: order.customer_info,
      items,
    });
  } catch (err) {
    next(err);
  }
};
