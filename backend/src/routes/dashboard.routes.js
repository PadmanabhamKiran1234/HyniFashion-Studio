
import express from 'express';

import {
  getDashboardSummary,
  getDashboardSalesTrend
} from '../controllers/dashboard.controller.js';

import { protect } from '../middleware/auth.js';
import {
  authorizeAdminOrEmployee
} from '../middleware/employeePermission.js';

const router = express.Router();

router.use(protect);

router.get(
  '/summary',
  authorizeAdminOrEmployee('dashboard.view'),
  getDashboardSummary
);

router.get(
  '/sales-trend',
  authorizeAdminOrEmployee('dashboard.view'),
  getDashboardSalesTrend
);

export default router;
