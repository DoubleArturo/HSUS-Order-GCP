import { Router } from 'express';
import * as shipmentController from '../controllers/shipmentController.js';

const router = Router();

router.post('/', shipmentController.createShipment);

export default router;
