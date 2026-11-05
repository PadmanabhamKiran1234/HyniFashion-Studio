
import mongoose from 'mongoose';
import Inventory from '../models/Inventory.js';
import Product from '../models/Product.js';
import { generateBusinessId } from '../utils/generateId.js';

// CREATE INDIVIDUAL INVENTORY UNITS
export async function createInventoryUnits({
  productId,
  quantity,
  addedBy,
  note = ''
}) {
  const count = Number(quantity);

  if (!Number.isInteger(count) || count < 1) {
    throw new Error('Inventory quantity must be a positive integer.');
  }

  if (!mongoose.isValidObjectId(productId)) {
    throw new Error('Invalid product ID.');
  }

  const productExists = await Product.exists({ _id: productId });

  if (!productExists) {
    throw new Error('Product not found.');
  }

  const records = Array.from({ length: count }, () => ({
    inventoryId: generateBusinessId('INV'),
    productId,
    status: 'available',
    addedBy: addedBy || null,
    note: String(note).trim()
  }));

  try {
    const createdRecords = await Inventory.insertMany(records, {
      ordered: true
    });

    return createdRecords;
  } catch (error) {
    if (error.code === 11000) {
      throw new Error(
        'Duplicate inventory ID detected. Please retry the stock creation.'
      );
    }

    throw error;
  }
}

// GET AVAILABLE STOCK COUNT
export async function getAvailableStock(productId) {
  return Inventory.countDocuments({
    productId,
    status: 'available'
  });
}

// SYNCHRONIZE PRODUCT STOCK
export async function syncProductStock(productId) {
  const availableStock = await getAvailableStock(productId);

  const product = await Product.findByIdAndUpdate(
    productId,
    {
      $set: { stock: availableStock }
    },
    { new: true }
  );

  if (!product) {
    throw new Error('Product not found while synchronizing stock.');
  }

  return availableStock;
}

// GET COMPLETE INVENTORY COUNTS FOR A PRODUCT
export async function getInventoryCounts(productId) {
  const counts = await Inventory.aggregate([
    {
      $match: {
        productId: new mongoose.Types.ObjectId(productId)
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  return {
    available: counts.find(item => item._id === 'available')?.count || 0,
    reserved: counts.find(item => item._id === 'reserved')?.count || 0,
    sold: counts.find(item => item._id === 'sold')?.count || 0,
    removed: counts.find(item => item._id === 'removed')?.count || 0
  };
}
