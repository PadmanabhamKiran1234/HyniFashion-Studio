import mongoose from 'mongoose';

import Inventory from '../models/Inventory.js';
import Product from '../models/Product.js';

import {
  createInventoryUnits,
  syncProductStock,
  getAvailableStock
} from '../services/inventory.service.js';

// GET INVENTORY RECORDS
export async function getInventory(req, res, next) {
  try {
    const {
      productId = '',
      status = '',
      search = '',
      page = 1,
      limit = 20
    } = req.query;

    const currentPage = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));

    const filter = {};

    if (productId) {
      if (!mongoose.isValidObjectId(productId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid product ID.'
        });
      }

      filter.productId = productId;
    }

    if (
      status &&
      ['available', 'reserved', 'sold', 'removed'].includes(status)
    ) {
      filter.status = status;
    }

    if (search.trim()) {
      filter.inventoryId = {
        $regex: search.trim(),
        $options: 'i'
      };
    }

    const [inventory, total] = await Promise.all([
      Inventory.find(filter)
        .populate('productId', 'id name code image price')
        .populate('soldBy', 'userId name email')
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * pageSize)
        .limit(pageSize),

      Inventory.countDocuments(filter)
    ]);

    return res.json({
      success: true,
      inventory,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize)
      }
    });

  } catch (error) {
    next(error);
  }
}

// INVENTORY SUMMARY
export async function getInventorySummary(req, res, next) {
  try {
    const [
      available,
      reserved,
      sold,
      removed,
      lowStockProducts
    ] = await Promise.all([
      Inventory.countDocuments({ status: 'available' }),
      Inventory.countDocuments({ status: 'reserved' }),
      Inventory.countDocuments({ status: 'sold' }),
      Inventory.countDocuments({ status: 'removed' }),

      Product.find({
        status: 'Active',
        $expr: {
          $lte: ['$stock', '$lowStockThreshold']
        }
      }).select('id name code stock lowStockThreshold')
    ]);

    return res.json({
      success: true,

      summary: {
        available,
        reserved,
        sold,
        removed,
        lowStockCount: lowStockProducts.length
      },

      lowStockProducts
    });

  } catch (error) {
    next(error);
  }
}

// ADD OR REMOVE STOCK


export async function adjustInventory(req, res, next) {
  let productStockReserved = false;
  let claimedUnits = [];
  let quantityChange = 0;
  let reason = '';

  try {
    const { change } = req.body;
    reason = req.body.reason;

    quantityChange = Number(change);

    // VALIDATE QUANTITY
    if (
      change === undefined ||
      change === null ||
      change === '' ||
      !Number.isSafeInteger(quantityChange) ||
      quantityChange === 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Stock change must be a non-zero integer.'
      });
    }

    if (Math.abs(quantityChange) > 10000) {
      return res.status(400).json({
        success: false,
        message: 'Maximum stock adjustment per request is 10000 units.'
      });
    }

    // VALIDATE REASON
    if (
      typeof reason !== 'string' ||
      reason.trim().length < 3 ||
      reason.trim().length > 300
    ) {
      return res.status(400).json({
        success: false,
        message: 'Reason must contain between 3 and 300 characters.'
      });
    }

    reason = reason.trim();

    // VALIDATE PRODUCT ID
    if (!mongoose.isValidObjectId(req.params.productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID.'
      });
    }

    const product = await Product.findById(req.params.productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    // =====================================
    // ADD STOCK
    // =====================================

    if (quantityChange > 0) {
      if (product.status !== 'Active') {
        return res.status(400).json({
          success: false,
          message: 'Cannot add stock to an inactive product.'
        });
      }

      const createdUnits = await createInventoryUnits({
        productId: product._id,
        quantity: quantityChange,
        addedBy: req.user._id,
        note: reason
      });

      // Increment stock atomically instead of recounting
      // all inventory records.
      const stockUpdate = await Product.updateOne(
        {
          _id: product._id,
          status: 'Active'
        },
        {
          $inc: {
            stock: createdUnits.length
          }
        }
      );

      if (stockUpdate.modifiedCount !== 1) {
        await Inventory.deleteMany({
          _id: { $in: createdUnits.map(unit => unit._id) },
          status: 'available'
        });

        return res.status(409).json({
          success: false,
          message: 'Product could not be updated. Added inventory records were rolled back.'
        });
      }

      const updatedProduct = await Product.findById(product._id)
        .select('id code name stock');

      return res.json({
        success: true,
        message: 'Stock added successfully.',
        product: {
          productId: updatedProduct.id,
          productCode: updatedProduct.code,
          name: updatedProduct.name,
          availableStock: updatedProduct.stock
        },
        stockChange: quantityChange,
        reason
      });
    }

    // =====================================
    // REMOVE STOCK
    // =====================================

    const removeCount = Math.abs(quantityChange);

    // Reserve stock using an atomic conditional update.
    const stockUpdate = await Product.updateOne(
      {
        _id: product._id,
        stock: { $gte: removeCount }
      },
      {
        $inc: {
          stock: -removeCount
        }
      }
    );

    if (stockUpdate.modifiedCount !== 1) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient available stock.'
      });
    }

    productStockReserved = true;

    // Atomically claim individual available units.
    // Each request can claim a unit only once.
    for (let i = 0; i < removeCount; i++) {
      const unit = await Inventory.findOneAndUpdate(
        {
          productId: product._id,
          status: 'available'
        },
        {
          $set: {
            status: 'removed',
            note: reason
          }
        },
        {
          new: false,
          sort: {
            createdAt: 1,
            _id: 1
          }
        }
      );

      if (!unit) {
        const error = new Error(
          'Inventory records do not match product stock. Adjustment cancelled.'
        );

        error.statusCode = 409;
        throw error;
      }

      // Preserve the original note for rollback.
      claimedUnits.push({
        _id: unit._id,
        previousNote: unit.note || ''
      });
    }

    productStockReserved = false;

    const updatedProduct = await Product.findById(product._id)
      .select('id code name stock');

    return res.json({
      success: true,
      message: 'Stock removed successfully.',
      product: {
        productId: updatedProduct.id,
        productCode: updatedProduct.code,
        name: updatedProduct.name,
        availableStock: updatedProduct.stock
      },
      stockChange: quantityChange,
      reason
    });

  } catch (error) {
    // =====================================
    // COMPENSATING ROLLBACK
    // =====================================

    let restoredCount = 0;
    let rollbackError = null;

    // Restore only the units claimed by this request.
    for (const unit of claimedUnits) {
      try {
        const restored = await Inventory.updateOne(
          {
            _id: unit._id,
            status: 'removed',
            note: reason
          },
          {
            $set: {
              status: 'available',
              note: unit.previousNote
            }
          }
        );

        restoredCount += restored.modifiedCount;

      } catch (restoreError) {
        rollbackError = restoreError;
      }
    }

    // Restore the product counter.
    if (productStockReserved) {
      const compensation =
        Math.abs(quantityChange) -
        claimedUnits.length +
        restoredCount;

      try {
        if (compensation > 0) {
          await Product.updateOne(
            { _id: req.params.productId },
            {
              $inc: {
                stock: compensation
              }
            }
          );
        }
      } catch (restoreError) {
        rollbackError = restoreError;
      }
    }

    if (rollbackError) {
      console.error('Inventory rollback failed:', rollbackError);

      return res.status(500).json({
        success: false,
        message: 'Inventory adjustment failed and rollback was incomplete. Admin verification is required.'
      });
    }

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
}


// LOW STOCK PRODUCTS
export async function getLowStockProducts(req, res, next) {
  try {
    const products = await Product.find({
      status: 'Active',
      $expr: {
        $lte: ['$stock', '$lowStockThreshold']
      }
    }).sort({ stock: 1 });

    return res.json({
      success: true,
      count: products.length,
      products
    });

  } catch (error) {
    next(error);
  }
}