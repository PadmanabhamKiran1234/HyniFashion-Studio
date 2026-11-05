import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import { testImageUpload } from '../controllers/upload.controller.js';

const router = express.Router();

router.post(
  '/test-image',
  protect,
  authorize('admin'),
  upload.single('image'),
  testImageUpload
);

export default router;