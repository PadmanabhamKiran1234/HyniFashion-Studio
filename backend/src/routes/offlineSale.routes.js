import express from 'express';

import {
  createOfflineSale,
  getOfflineSales,
  getOfflineSaleDetails,
  getOfflineSalesSummary
} from '../controllers/offlineSale.controller.js';

import { protect } from '../middleware/auth.js';

import {
  authorizeAdminOrEmployee
} from '../middleware/employeePermission.js';

const router = express.Router();

router.use(protect);

// Create an offline sale
router.post(
  '/',
  authorizeAdminOrEmployee('offlineSales.manage'),
  createOfflineSale
);

// Offline sales summary
router.get(
  '/summary',
  authorizeAdminOrEmployee('offlineSales.view'),
  getOfflineSalesSummary
);

// List offline sales
router.get(
  '/',
  authorizeAdminOrEmployee('offlineSales.view'),
  getOfflineSales
);

// Individual offline sale
router.get(
  '/:saleId',
  authorizeAdminOrEmployee('offlineSales.view'),
  getOfflineSaleDetails
);

export default router;