
import express from 'express';

import {
  getOrderPaymentQR,
  submitPaymentProof,
  getPendingPaymentVerifications,
  verifyPayment,
  rejectPayment
} from '../controllers/payment.controller.js';
import {
  getPaymentSupportContact,
  manuallyVerifyPayment
} from '../controllers/manualPayment.controller.js';
import {
  protect,
  authorize
} from '../middleware/auth.js';

import upload from '../middleware/upload.js';

const router = express.Router();

// CUSTOMER AND WHOLESALE PAYMENT ROUTES

router.get(
  '/orders/:orderId/qr',
  protect,
  authorize('customer', 'wholesale'),
  getOrderPaymentQR
);

router.post(
  '/orders/:orderId/submit',
  protect,
  authorize('customer', 'wholesale'),
  upload.single('screenshot'),
  submitPaymentProof
);

// ADMIN PAYMENT VERIFICATION ROUTES

router.get(
  '/admin/pending',
  protect,
  authorize('admin'),
  getPendingPaymentVerifications
);

router.patch(
  '/admin/:orderId/verify',
  protect,
  authorize('admin'),
  verifyPayment
);

router.patch(
  '/admin/:orderId/reject',
  protect,
  authorize('admin'),
  rejectPayment
);


// Customer and wholesale payment support
router.get(
  '/support-contact',
  protect,
  authorize('customer', 'wholesale'),
  getPaymentSupportContact
);

// Admin manually verifies a payment without uploaded proof
router.patch(
  '/admin/:orderId/manual-verify',
  protect,
  authorize('admin'),
  manuallyVerifyPayment
);
export default router;
