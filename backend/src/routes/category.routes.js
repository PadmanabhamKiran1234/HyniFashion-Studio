import { Router } from 'express';

import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  getAdminCategories
} from '../controllers/category.controller.js';

import {
  protect,
  authorize
} from '../middleware/auth.js';

const router = Router();

// Public
router.get('/', getCategories);
router.get('/:id', getCategoryById);

// Admin only
router.post(
  '/',
  protect,
  authorize('admin'),
  createCategory
);

router.put(
  '/:id',
  protect,
  authorize('admin'),
  updateCategory
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  deleteCategory
);
router.get(
  '/admin/all',
  protect,
  authorize('admin'),
  getAdminCategories
);
export default router;