
import Order from '../models/Order.js';
import Inventory from '../models/Inventory.js';

import { uploadImage, deleteImage } from '../services/cloudinary.service.js';
import { generateUpiPaymentQR } from '../services/upi.service.js';

// CUSTOMER: GET PAYMENT QR AGAIN
export const getOrderPaymentQR = async (req, res, next) => {
  try {
    const order = await Order.findOne({
      orderId: req.params.orderId,
      customerId: req.user._id
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    if (
      !['pending_payment', 'payment_verification'].includes(order.status)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Payment QR is not available for this order.'
      });
    }

    if (
      order.reservationExpiresAt &&
      order.reservationExpiresAt <= new Date()
    ) {
      return res.status(410).json({
        success: false,
        message: 'The payment reservation has expired.'
      });
    }

    const payment = await generateUpiPaymentQR({
      amount: order.pricing.finalAmount,
      orderReference: order.orderId,
      note: `Hyni Order ${order.orderId}`
    });

    return res.status(200).json({
      success: true,
      payment: {
        method: 'UPI',
        amount: payment.amount,
        currency: payment.currency,
        receiverName: payment.receiverName,
        receiverUpiId: payment.upiId,
        orderReference: payment.orderReference,
        qrCode: payment.qrCode
      }
    });
  } catch (error) {
    next(error);
  }
};

// CUSTOMER: SUBMIT UTR AND PAYMENT SCREENSHOT
export const submitPaymentProof = async (req, res, next) => {
  let uploadedImage = null;

  try {
    const { utrNumber } = req.body;

    const normalizedUtr = String(utrNumber || '')
      .trim()
      .replace(/\s+/g, '')
      .toUpperCase();

    if (!/^[A-Z0-9]{6,22}$/.test(normalizedUtr)) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid UTR or transaction reference number.'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload your payment screenshot.'
      });
    }

    const order = await Order.findOne({
      orderId: req.params.orderId,
      customerId: req.user._id
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    if (order.status !== 'pending_payment') {
      return res.status(400).json({
        success: false,
        message: 'This order is not accepting payment submissions.'
      });
    }

    if (
      order.reservationExpiresAt &&
      order.reservationExpiresAt <= new Date()
    ) {
      return res.status(410).json({
        success: false,
        message: 'Your payment reservation has expired. Please contact the store.'
      });
    }

    if (order.payment.status === 'submitted' ||
        order.payment.status === 'verified') {
      return res.status(409).json({
        success: false,
        message: 'Payment proof has already been submitted or verified.'
      });
    }

    // Prevent reuse of another order's UTR.
    const existingUtr = await Order.findOne({
      _id: { $ne: order._id },
      'payment.utrNumber': normalizedUtr
    }).select('_id orderId');

    if (existingUtr) {
      return res.status(409).json({
        success: false,
        message: 'This transaction reference has already been submitted.'
      });
    }

    // Upload screenshot to Cloudinary.
    uploadedImage = await uploadImage(
      req.file.buffer,
      'hyni/payment-proofs'
    );

    const previousPublicId = order.payment.screenshotPublicId;

    order.payment.utrNumber = normalizedUtr;
    order.payment.screenshotUrl = uploadedImage.url;
    order.payment.screenshotPublicId = uploadedImage.publicId;
    order.payment.status = 'submitted';
    order.payment.submittedAt = new Date();
    order.payment.rejectionReason = '';

    order.status = 'payment_verification';

    await order.save();

    // Remove previous rejected proof after the new proof is saved.
    if (previousPublicId) {
      deleteImage(previousPublicId).catch(error => {
        console.error('Old payment screenshot deletion failed:', error.message);
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment proof submitted successfully. Waiting for Admin verification.',
      order: {
        orderId: order.orderId,
        status: order.status,
        paymentStatus: order.payment.status,
        utrNumber: order.payment.utrNumber,
        submittedAt: order.payment.submittedAt
      }
    });

  } catch (error) {
    // Avoid leaving an unused image in Cloudinary.
    if (uploadedImage?.publicId) {
      await deleteImage(uploadedImage.publicId).catch(() => {});
    }

    next(error);
  }
};

// ADMIN: VIEW PAYMENTS WAITING FOR VERIFICATION
export const getPendingPaymentVerifications = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const filter = {
      'payment.status': 'submitted',
      status: 'payment_verification'
    };

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('customerId', 'userId name email mobile')
        .sort({ 'payment.submittedAt': 1 })
        .skip(skip)
        .limit(limit),

      Order.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      orders
    });
  } catch (error) {
    next(error);
  }
};

// ADMIN: VERIFY PAYMENT AND MARK INVENTORY AS SOLD

export const verifyPayment = async (req, res, next) => {
  let claimedOrder = null;
  let changedInventory = false;

  try {
    claimedOrder = await Order.findOneAndUpdate(
      {
        orderId: req.params.orderId,
        status: 'payment_verification',
        'payment.status': 'submitted'
      },
      {
        $set: {
          'payment.status': 'verifying'
        }
      },
      { new: true }
    );

    if (!claimedOrder) {
      return res.status(409).json({
        success: false,
        message: 'Order is not waiting for payment verification.'
      });
    }

    const expectedUnits = claimedOrder.items.reduce(
      (total, item) => total + item.quantity,
      0
    );

    const reservedUnits = await Inventory.countDocuments({
      reservedForOrder: claimedOrder._id,
      status: 'reserved'
    });

    if (reservedUnits !== expectedUnits) {
      throw new Error(
        'Reserved inventory does not match the order quantity.'
      );
    }

    const result = await Inventory.updateMany(
      {
        reservedForOrder: claimedOrder._id,
        status: 'reserved'
      },
      {
        $set: {
          status: 'sold',
          soldAt: new Date(),
          soldBy: req.user._id,
          saleReference: claimedOrder.orderId,
          reservedForOrder: null,
          reservedAt: null,
          reservationExpiresAt: null
        }
      }
    );

    changedInventory = result.modifiedCount > 0;

    if (result.modifiedCount !== expectedUnits) {
      throw new Error(
        'Not all reserved inventory units could be marked as sold.'
      );
    }

    const confirmedOrder = await Order.findOneAndUpdate(
      {
        _id: claimedOrder._id,
        status: 'payment_verification',
        'payment.status': 'verifying'
      },
      {
        $set: {
          status: 'confirmed',
          'payment.status': 'verified',
          'payment.verifiedBy': req.user._id,
          'payment.verifiedAt': new Date(),
          'payment.rejectionReason': ''
        }
      },
      { new: true }
    );

    if (!confirmedOrder) {
      throw new Error('Could not finalize order confirmation.');
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified and order confirmed successfully.',
      order: {
        orderId: confirmedOrder.orderId,
        status: confirmedOrder.status,
        paymentStatus: confirmedOrder.payment.status,
        verifiedAt: confirmedOrder.payment.verifiedAt
      },
      inventoryUnitsSold: result.modifiedCount
    });

  } catch (error) {
    if (claimedOrder) {
      if (changedInventory) {
        await Inventory.updateMany(
          {
            saleReference: claimedOrder.orderId,
            status: 'sold'
          },
          {
            $set: {
              status: 'reserved',
              reservedForOrder: claimedOrder._id,
              soldAt: null,
              soldBy: null,
              saleReference: '',
              reservedAt: new Date(),
              reservationExpiresAt: claimedOrder.reservationExpiresAt
            }
          }
        ).catch(rollbackError => {
          console.error(
            'Inventory verification rollback failed:',
            rollbackError.message
          );
        });
      }

      await Order.updateOne(
        {
          _id: claimedOrder._id,
          status: 'payment_verification',
          'payment.status': 'verifying'
        },
        {
          $set: {
            'payment.status': 'submitted'
          }
        }
      ).catch(rollbackError => {
        console.error(
          'Order verification rollback failed:',
          rollbackError.message
        );
      });
    }

    next(error);
  }
};


// ADMIN: REJECT PAYMENT PROOF
export const rejectPayment = async (req, res, next) => {
  try {
    const reason = String(req.body.reason || '').trim();

    if (reason.length < 3 || reason.length > 300) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason must contain 3 to 300 characters.'
      });
    }

    const order = await Order.findOneAndUpdate(
      {
        orderId: req.params.orderId,
        status: 'payment_verification',
        'payment.status': 'submitted'
      },
      {
        $set: {
          status: 'pending_payment',
          'payment.status': 'rejected',
          'payment.rejectionReason': reason,
          'payment.verifiedBy': null,
          'payment.verifiedAt': null
        }
      },
      { new: true }
    );

    if (!order) {
      return res.status(409).json({
        success: false,
        message: 'Order is not waiting for payment verification.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment proof rejected. Customer can submit corrected proof before reservation expiry.',
      order: {
        orderId: order.orderId,
        status: order.status,
        paymentStatus: order.payment.status,
        rejectionReason: order.payment.rejectionReason
      }
    });
  } catch (error) {
    next(error);
  }
};
