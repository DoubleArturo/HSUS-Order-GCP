import express from 'express';
import * as bolController from '../controllers/bolController.js';
const router = express.Router();
/**
 * GET /api/bol/initial-data
 * Fetch list of pending/fulfilled orders for the BOL tool.
 */
router.get('/initial-data', bolController.getInitialData);
/**
 * GET /api/bol/:poSkuKey
 * Fetch specific order/shipment details for the BOL tool.
 */
router.get('/:poSkuKey', bolController.getExistingData);
/**
 * POST /api/bol/save
 * Save BOL data (Shipments & Status) for an order.
 */
router.post('/save', bolController.saveData);
export default router;
