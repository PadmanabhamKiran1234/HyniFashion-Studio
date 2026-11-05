import express from 'express';

import { getAdminCustomers } from '../controllers/customer.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/', getAdminCustomers);

export default router;
