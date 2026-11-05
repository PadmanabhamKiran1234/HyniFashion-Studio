
import Order from '../models/Order.js';
import Inventory from '../models/Inventory.js';
import {
  reserveOrderInventory,
  releaseOrderInventory
} from '../services/order.service.js';
import { syncProductStock } from '../services/inventory.service.js';

// Customer-facing admin support contact
export const getPaymentSupportContact = async (req, res) => {
  return res.status(200).json({
    success: true,
    support: {
      mobile: process.env.ADMIN_SUPPORT_MOBILE || '9999999999',
      message:
        'If you completed your UPI payment but forgot to submit your UTR number or screenshot, contact our admin with your order ID.'
    }
  });
};

// Admin manually verifies actual UPI credit
export const manuallyVerifyPayment = async (req, res) => {
  let claimedOrder = null;
  let originalPaymentStatus = null;
  let originalOrderStatus = null;
  let inventoryWasReReserved = false;
  let inventoryMarkedSold = false;

  try {
    const { orderId } = req.params;
    const { verificationNote } = req.body;

    if (
      typeof verificationNote !== 'string' ||
      verificationNote.trim().length < 5
    ) {
      return res.status(400).json({
        success: false,
        message: 'Enter a verification note of at least 5 characters.'
      });
    }

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    const allowedPaymentStatuses = ['pending', 'rejected', 'expired'];

    if (
      !['pending_payment', 'cancelled'].includes(order.status) ||
      !allowedPaymentStatuses.includes(order.payment.status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'This order is not eligible for manual payment verification.'
      });
    }

    originalPaymentStatus = order.payment.status;
    originalOrderStatus = order.status;

    const wasExpired =
      order.status === 'cancelled' &&
      order.payment.status === 'expired';

    // Claim the order to prevent simultaneous expiry or verification.
    claimedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        status: originalOrderStatus,
        'payment.status': originalPaymentStatus
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
        message: 'Order is already being processed. Refresh and try again.'
      });
    }

    // Expired orders need to reserve stock again.
    if (wasExpired) {
      await reserveOrderInventory(claimedOrder);
      inventoryWasReReserved = true;
    }

    const expectedQuantity = claimedOrder.items.reduce(
      (total, item) => total + item.quantity,
      0
    );

    const reservedQuantity = await Inventory.countDocuments({
      reservedForOrder: claimedOrder._id,
      status: 'reserved'
    });

    if (reservedQuantity !== expectedQuantity) {
      throw new Error(
        `Insufficient reserved inventory. Expected ${expectedQuantity}, found ${reservedQuantity}.`
      );
    }

    const saleDate = new Date();

    const soldResult = await Inventory.updateMany(
      {
        reservedForOrder: claimedOrder._id,
        status: 'reserved'
      },
      {
        $set: {
          status: 'sold',
          soldAt: saleDate,
          soldBy: req.user._id,
          saleReference: claimedOrder.orderId
        },
        $unset: {
          reservedForOrder: '',
          reservedAt: '',
          reservationExpiresAt: ''
        }
      }
    );

    inventoryMarkedSold = soldResult.modifiedCount > 0;

    if (soldResult.modifiedCount !== expectedQuantity) {
      throw new Error(
        `Inventory update incomplete. Expected ${expectedQuantity}, updated ${soldResult.modifiedCount}.`
      );
    }

    const productIds = [
      ...new Set(
        claimedOrder.items.map(item => item.productId.toString())
      )
    ];

    for (const productId of productIds) {
      await syncProductStock(productId);
    }

    const auditNote =
      `Payment manually verified by admin ${req.user._id} at ${saleDate.toISOString()}. ${verificationNote.trim()}`;

    // Finalize payment, order and audit note together.
    const verifiedOrder = await Order.findOneAndUpdate(
      {
        _id: claimedOrder._id,
        status: originalOrderStatus,
        'payment.status': 'verifying'
      },
      {
        $set: {
          status: 'confirmed',
          'payment.status': 'verified',
          'payment.verificationMethod': 'manual_admin',
          'payment.verificationNote': verificationNote.trim(),
          'payment.verifiedBy': req.user._id,
          'payment.verifiedAt': saleDate,
          inventoryReservedAt: wasExpired
            ? saleDate
            : claimedOrder.inventoryReservedAt,
          notes: auditNote
        }
      },
      { new: true }
    );

    if (!verifiedOrder) {
      throw new Error('Could not finalize the verified order.');
    }

    return res.status(200).json({
      success: true,
      message: 'Payment manually verified and order confirmed.',
      order: {
        orderId: verifiedOrder.orderId,
        status: verifiedOrder.status,
        paymentStatus: verifiedOrder.payment.status,
        verificationMethod: verifiedOrder.payment.verificationMethod,
        verificationNote: verifiedOrder.payment.verificationNote,
        verifiedAt: verifiedOrder.payment.verifiedAt,
        verifiedBy: verifiedOrder.payment.verifiedBy
      }
    });
  } catch (error) {
    console.error('Manual payment verification error:', error);

    // Roll back inventory records if they were changed to sold.
    if (claimedOrder && inventoryMarkedSold) {
      try {
        await Inventory.updateMany(
          {
            saleReference: claimedOrder.orderId,
            status: 'sold'
          },
          {
            $set: {
              status: 'reserved'
            },
            $unset: {
              soldAt: '',
              soldBy: '',
              saleReference: ''
            }
          }
        );

        const productIds = [
          ...new Set(
            claimedOrder.items.map(item => item.productId.toString())
          )
        ];

        for (const productId of productIds) {
          await syncProductStock(productId);
        }
      } catch (rollbackError) {
        console.error(
          'Inventory rollback failed:',
          rollbackError.message
        );
      }
    }

    // If the order was expired, release any stock re-reserved
    // during this unsuccessful verification attempt.
    if (claimedOrder && inventoryWasReReserved) {
      try {
        await releaseOrderInventory(claimedOrder._id);
      } catch (releaseError) {
        console.error(
          'Inventory release failed:',
          releaseError.message
        );
      }
    }

    if (claimedOrder) {
      try {
        await Order.updateOne(
          {
            _id: claimedOrder._id,
            'payment.status': 'verifying'
          },
          {
            $set: {
              status: originalOrderStatus,
              'payment.status': originalPaymentStatus
            }
          }
        );
      } catch (resetError) {
        console.error(
          'Order status reset failed:',
          resetError.message
        );
      }
    }

    const stockIssue =
      error.message.includes('Insufficient reserved inventory') ||
      error.message.includes('Insufficient stock');

    return res.status(stockIssue ? 409 : 500).json({
      success: false,
      message: stockIssue
        ? 'Required stock is no longer available. The order could not be confirmed.'
        : 'Manual payment verification failed.',
      error: error.message
    });
  }
};
