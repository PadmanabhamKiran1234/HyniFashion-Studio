import express from 'express';

import {
  getAllEmployees,
  getEmployeeDetails,
  updateEmployee,
  getAvailableEmployeePermissions,
  getMyEmployeeProfile,
  updateMyEmployeeProfile
} from '../controllers/employee.controller.js';

import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// EMPLOYEE PROFILE
router.get(
  '/me',
  protect,
  authorize('employee'),
  getMyEmployeeProfile
);

router.patch(
  '/me',
  protect,
  authorize('employee'),
  updateMyEmployeeProfile
);

// ADMIN EMPLOYEE MANAGEMENT
router.use('/admin', protect, authorize('admin'));

router.get(
  '/admin/permissions',
  getAvailableEmployeePermissions
);

router.get(
  '/admin',
  getAllEmployees
);

router.get(
  '/admin/:employeeId',
  getEmployeeDetails
);

router.patch(
  '/admin/:employeeId',
  updateEmployee
);

export default router;