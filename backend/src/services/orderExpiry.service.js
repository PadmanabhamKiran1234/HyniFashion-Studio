
import Order from '../models/Order.js';
import { releaseOrderInventory } from './order.service.js';

const RESERVATION_EXPIRY_MINUTES = 30;

export const expireUnpaidOrders = async () => {
  const now = new Date();

  const expiredOrders = await Order.find({
    status: 'pending_payment',
    reservationExpiresAt: { $lte: now },
    'payment.status': {
      $in: ['pending', 'rejected', 'expiring']
    }
  }).select('_id orderId');

  let expiredCount = 0;

  for (const order of expiredOrders) {
    try {
      // Claim the order so payment submission cannot proceed.
      const claimedOrder = await Order.findOneAndUpdate(
        {
          _id: order._id,
          status: 'pending_payment',
          reservationExpiresAt: { $lte: now },
          'payment.status': {
            $in: ['pending', 'rejected', 'expiring']
          }
        },
        {
          $set: {
            'payment.status': 'expiring'
          }
        },
        { new: true }
      );

      if (!claimedOrder) {
        continue;
      }

      // Release reserved inventory and synchronize product stock.
      await releaseOrderInventory(claimedOrder._id);

      // Complete expiry. notes is a STRING in Order.js.
      const finalizedOrder = await Order.findOneAndUpdate(
        {
          _id: claimedOrder._id,
          status: 'pending_payment',
          'payment.status': 'expiring'
        },
        {
          $set: {
            status: 'cancelled',
            'payment.status': 'expired',
            notes: `Order automatically expired after ${RESERVATION_EXPIRY_MINUTES} minutes without payment proof. Inventory released at ${new Date().toISOString()}.`
          }
        },
        { new: true }
      );

      if (finalizedOrder) {
        expiredCount++;

        console.log(
          `Expired order ${finalizedOrder.orderId}; reserved inventory released.`
        );
      }
    } catch (error) {
      console.error(
        `Failed to expire order ${order.orderId}:`,
        error.message
      );
    }
  }

  return {
    checked: expiredOrders.length,
    expired: expiredCount
  };
};
