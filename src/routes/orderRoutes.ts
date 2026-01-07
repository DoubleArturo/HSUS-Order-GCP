import { Router } from 'express';
import * as orderController from '../controllers/orderController.js';

const router = Router();

router.get('/:order_number', orderController.getOrderByNumber);

export default router;
