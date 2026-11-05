import express from 'express';

import {
  previewCheckout,
  createOrder
} from '../controllers/checkout.controller.js';

import {
  protect,
  authorize
} from '../middleware/auth.js';

const router = express.Router();

router.use(protect, authorize('customer', 'wholesale'));

router.get('/preview', previewCheckout);
router.post('/orders', createOrder);

export default router;