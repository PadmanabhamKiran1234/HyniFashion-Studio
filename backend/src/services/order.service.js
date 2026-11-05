
import mongoose from 'mongoose';
import Inventory from '../models/Inventory.js';
import { syncProductStock } from './inventory.service.js';

export async function reserveOrderInventory(order) {
  const reservedProductIds = new Set();

  try {
    for (const item of order.items) {
      for (let i = 0; i < item.quantity; i++) {
        const inventoryUnit = await Inventory.findOneAndUpdate(
          {
            productId: item.productId,
            status: 'available'
          },
          {
            $set: {
              status: 'reserved',
              reservedForOrder: order._id,
              reservedAt: new Date(),
              reservationExpiresAt: order.reservationExpiresAt
            }
          },
          {
            new: true,
            sort: { createdAt: 1 }
          }
        );

        if (!inventoryUnit) {
          throw new Error(
            `Insufficient stock for ${item.productName}.`
          );
        }

        reservedProductIds.add(String(item.productId));
      }
    }

    for (const productId of reservedProductIds) {
      await syncProductStock(productId);
    }

    return true;
  } catch (error) {
    await releaseOrderInventory(order._id);

    for (const productId of reservedProductIds) {
      await syncProductStock(productId).catch(() => {});
    }

    throw error;
  }
}

export async function releaseOrderInventory(orderId) {
  if (!mongoose.isValidObjectId(orderId)) {
    throw new Error('Invalid order ID.');
  }

  const reservedRecords = await Inventory.find({
    reservedForOrder: orderId,
    status: 'reserved'
  }).select('productId');

  const productIds = [
    ...new Set(reservedRecords.map(item => String(item.productId)))
  ];

  await Inventory.updateMany(
    {
      reservedForOrder: orderId,
      status: 'reserved'
    },
    {
      $set: {
        status: 'available',
        reservedForOrder: null,
        reservedAt: null,
        reservationExpiresAt: null
      }
    }
  );

  for (const productId of productIds) {
    await syncProductStock(productId);
  }

  return productIds;
}
