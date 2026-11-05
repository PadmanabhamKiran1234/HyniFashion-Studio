import express from 'express';

import { protect, authorize } from '../middleware/auth.js';

import {
  validateWholesaleCheckout
} from '../controllers/wholesale.controller.js';

const router = express.Router();

router.use(protect, authorize('wholesale'));

router.get(
  '/checkout-validation',
  validateWholesaleCheckout
);

export default router;