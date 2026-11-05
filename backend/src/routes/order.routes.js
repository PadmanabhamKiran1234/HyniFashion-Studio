import express from 'express';

import {
  getMyOrders,
  getMyOrderDetails,
  getAllOrders,
  getAdminOrderDetails,
  updateOrderStatus,
  updateOrderTracking
} from '../controllers/order.controller.js';
import { authorizeAdminOrEmployee } from '../middleware/employeePermission.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// All order routes require authentication.
router.use(protect);

// CUSTOMER AND WHOLESALE
router.get(
  '/my',
  authorize('customer', 'wholesale'),
  getMyOrders
);

router.get(
  '/my/:orderId',
  authorize('customer', 'wholesale'),
  getMyOrderDetails
);

// ADMIN

// ADMIN OR EMPLOYEE WITH VIEW PERMISSION
router.get(
  '/admin',
  authorizeAdminOrEmployee('orders.view'),
  getAllOrders
);

router.get(
  '/admin/:orderId',
  authorizeAdminOrEmployee('orders.view'),
  getAdminOrderDetails
);

// ADMIN OR EMPLOYEE WITH MANAGEMENT PERMISSION
router.patch(
  '/admin/:orderId/status',
  authorizeAdminOrEmployee('orders.manage'),
  updateOrderStatus
);

router.patch(
  '/admin/:orderId/tracking',
  authorizeAdminOrEmployee('orders.manage'),
  updateOrderTracking
);
export default router;