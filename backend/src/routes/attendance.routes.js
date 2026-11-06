import express from 'express';

import {
  checkIn,
  checkOut,
  getMyAttendance,
  getAdminAttendance
} from '../controllers/attendance.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// EMPLOYEE ROUTES - identity is taken only from the JWT.
router.post('/check-in', authorize('employee'), checkIn);
router.post('/check-out', authorize('employee'), checkOut);
router.get('/my-attendance', authorize('employee'), getMyAttendance);

// ADMIN ROUTES
router.get('/admin', authorize('admin'), getAdminAttendance);

export default router;
