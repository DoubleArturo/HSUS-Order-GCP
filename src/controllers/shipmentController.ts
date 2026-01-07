import { Request, Response, NextFunction } from 'express';
import { created } from '../utils/responses.js';
import { AppError } from '../utils/errors.js';
import * as shipmentService from '../services/shipmentService.js';

export const createShipment = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { order_number, tracking_number, carrier, shipped_at, items } = req.body;

    if (!order_number || !shipped_at || !Array.isArray(items)) {
      throw new AppError('order_number, shipped_at and items are required', 400, 'INVALID_INPUT');
    }

    const shipment = await shipmentService.createShipment({
      order_number,
      tracking_number,
      carrier,
      shipped_at,
      items,
    });

    created(res, { shipment_id: shipment.id }, 'Shipment recorded successfully.');
  } catch (err) {
    next(err);
  }
};
