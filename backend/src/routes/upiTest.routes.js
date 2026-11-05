
import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { generateUpiPaymentQR } from '../services/upi.service.js';

const router = express.Router();

router.use(protect, authorize('admin'));

router.post('/test-qr', async (req, res, next) => {
  try {
    const { amount, orderReference } = req.body;

    const payment = await generateUpiPaymentQR({
      amount,
      orderReference,
      note: 'Hyni Fashion Studio Test Payment'
    });

    res.status(200).json({
      success: true,
      message: 'UPI QR generated successfully.',
      payment
    });
  } catch (error) {
    next(error);
  }
});

export default router;
