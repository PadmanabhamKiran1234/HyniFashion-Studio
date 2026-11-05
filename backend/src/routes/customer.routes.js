
import express from 'express';

import { protect, authorize } from '../middleware/auth.js';

import {
  getCustomerProfile,
  updateCustomerProfile
} from '../controllers/customer.controller.js';

const router = express.Router();

// All routes require customer authentication.
router.use(protect, authorize('customer', 'wholesale'));

router.get('/', getCustomerProfile);
router.patch('/', updateCustomerProfile);

export default router;
