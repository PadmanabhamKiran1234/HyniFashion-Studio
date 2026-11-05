import express from 'express';

import {
  startChatbot,
  getOrderOptions,
  getPreviousOrders,
  askCurrentOrderId,
  getCurrentOrder,
  getOtherSupport
} from '../controllers/chatbot.controller.js';

import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Only logged-in customers and wholesale customers can use
// their personal order information through the chatbot.
router.use(protect, authorize('customer', 'wholesale'));

// Initial greeting
router.get('/start', startChatbot);

// Order Details options
router.get('/order-options', getOrderOptions);

// Previous Orders
router.get('/previous-orders', getPreviousOrders);

// Current Order: ask for Order ID
router.get('/current-order', askCurrentOrderId);

// Current Order: retrieve order using entered Order ID
router.get('/current-order/:orderId', getCurrentOrder);

// Others
router.get('/others', getOtherSupport);

export default router;