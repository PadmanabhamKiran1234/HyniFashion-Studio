import { Router } from 'express';

import {
  createProduct,
  getProducts,
  getAdminProducts,
  getProductById,
  updateProduct,
  deleteProduct
} from '../controllers/product.controller.js';

import {
  protect,
  authorize
} from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = Router();

// PUBLIC PRODUCT APIs
router.get('/', getProducts);

// ADMIN PRODUCT APIs
router.get(
  '/admin/all',
  protect,
  authorize('admin'),
  getAdminProducts
);

router.post(
  '/',
  protect,
  authorize('admin'),
  upload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'additionalImages', maxCount: 5 },
  ]),
  createProduct
);

router.put(
  '/:id',
  protect,
  authorize('admin'),
  upload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'additionalImages', maxCount: 5 },
  ]),
  updateProduct
);

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  deleteProduct
);

// PUBLIC PRODUCT DETAILS
router.get('/:id', getProductById);

export default router;