import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import {
  registerCustomer,
  registerWholesale,
  login,
  getMe,
  createEmployee,
  approveWholesale,
  listPendingWholesale
} from '../controllers/auth.controller.js';

import {
  protect,
  authorize
} from '../middleware/auth.js';

import {
  validateRegistration,
  validateLogin
} from '../validators/auth.validators.js';

const router = Router();

// Limit repeated login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,

  message: {
    success: false,
    message: 'Too many login attempts. Try again after 15 minutes.'
  }
});

// CUSTOMER REGISTRATION
router.post(
  '/customer/register',
  validateRegistration,
  registerCustomer
);

// WHOLESALE REGISTRATION
router.post(
  '/wholesale/register',
  validateRegistration,
  registerWholesale
);

// FOUR LOGIN ROUTES
for (const role of [
  'admin',
  'customer',
  'wholesale',
  'employee'
]) {
  router.post(
    `/${role}/login`,
    loginLimiter,
    validateLogin,

    (req, res, next) => {
      req.expectedRole = role;
      next();
    },

    login
  );
}

// CURRENT USER
router.get(
  '/me',
  protect,
  getMe
);

// ADMIN CREATES EMPLOYEE
router.post(
  '/admin/employees',
  protect,
  authorize('admin'),
  createEmployee
);

// ADMIN VIEWS PENDING WHOLESALE CUSTOMERS
router.get(
  '/admin/wholesale/pending',
  protect,
  authorize('admin'),
  listPendingWholesale
);

// ADMIN APPROVES WHOLESALE CUSTOMER
router.patch(
  '/admin/wholesale/:id/approve',
  protect,
  authorize('admin'),
  approveWholesale
);

export default router;