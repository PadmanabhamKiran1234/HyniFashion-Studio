import { Router } from 'express';

import {
  getInventory,
  getInventorySummary,
  adjustInventory,
  getLowStockProducts
} from '../controllers/inventory.controller.js';
import { authorizeAdminOrEmployee } from '../middleware/employeePermission.js';
import {
  protect,
  authorize
} from '../middleware/auth.js';

const router = Router();

// Every inventory endpoint requires admin login.
// router.use(protect, authorize('admin'));
router.use(protect);

// router.get('/', getInventory);

// router.get('/summary', getInventorySummary);

// router.get('/low-stock', getLowStockProducts);

// router.post('/:productId/adjust', adjustInventory);

router.get(
  '/',
  authorizeAdminOrEmployee('inventory.view'),
  getInventory
);

router.get(
  '/summary',
  authorizeAdminOrEmployee('inventory.view'),
  getInventorySummary
);

router.get(
  '/low-stock',
  authorizeAdminOrEmployee('inventory.view'),
  getLowStockProducts
);

router.post(
  '/:productId/adjust',
  authorizeAdminOrEmployee('inventory.manage'),
  adjustInventory
);

export default router;