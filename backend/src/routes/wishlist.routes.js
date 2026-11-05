import express from 'express';

import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist
} from '../controllers/wishlist.controller.js';

import {
  protect,
  authorize
} from '../middleware/auth.js';

const router = express.Router();

router.use(protect, authorize('customer', 'wholesale'));

router.get('/', getWishlist);

router.post('/items', addToWishlist);

router.delete('/items/:productId', removeFromWishlist);

router.delete('/', clearWishlist);

export default router;