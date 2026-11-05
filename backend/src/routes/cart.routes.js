import express from 'express';

import {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart
} from '../controllers/cart.controller.js';

import {
  protect,
  authorize
} from '../middleware/auth.js';

const router = express.Router();

router.use(protect, authorize('customer','wholesale'));

router.get('/', getCart);

router.post('/items', addToCart);

router.patch('/items/:productId', updateCartItem);

router.delete('/items/:cartItemId', removeCartItem);

router.delete('/', clearCart);

export default router;