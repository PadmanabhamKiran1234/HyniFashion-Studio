
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';
import OfflineSale from '../models/OfflineSale.js';
import { generateBusinessId } from '../utils/generateId.js';
import { syncProductStock } from '../services/inventory.service.js';

const roundMoney = value =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const escapeRegex = value =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// CREATE OFFLINE SALE
export const createOfflineSale = async (req, res) => {
  let sale = null;
  const changedInventoryIds = [];
  const affectedProductIds = new Set();

  try {
    const {
      customerName,
      customerMobile,
      items,
      paymentMethod,
      amountReceived,
      paymentReference,
      notes
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Add at least one product to the sale.'
      });
    }

    const allowedPaymentMethods = ['cash', 'upi', 'card', 'other'];

    if (!allowedPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method.'
      });
    }

    if (
      customerName !== undefined &&
      (typeof customerName !== 'string' || customerName.trim().length > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Customer name must be a valid string of at most 100 characters.'
      });
    }

    if (
      customerMobile !== undefined &&
      (typeof customerMobile !== 'string' || customerMobile.trim().length > 20)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Customer mobile must be a valid string of at most 20 characters.'
      });
    }

    if (notes !== undefined && typeof notes !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Notes must be a string.'
      });
    }

    // Validate and combine duplicate product lines.
    const quantityByProduct = new Map();
    const lineOptions = new Map();

    for (const item of items) {
      if (!mongoose.Types.ObjectId.isValid(item.productId)) {
        return res.status(400).json({
          success: false,
          message: 'One or more product IDs are invalid.'
        });
      }

      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
        return res.status(400).json({
          success: false,
          message: 'Each product quantity must be a positive integer.'
        });
      }

      const productId = item.productId.toString();
      const currentQuantity = quantityByProduct.get(productId) || 0;

      quantityByProduct.set(productId, currentQuantity + quantity);

      const options = lineOptions.get(productId) || [];

      options.push({
        quantity,
        size: typeof item.size === 'string' ? item.size.trim() : '',
        color: typeof item.color === 'string' ? item.color.trim() : ''
      });

      lineOptions.set(productId, options);
    }

    const productIds = [...quantityByProduct.keys()];

    const products = await Product.find({
      _id: { $in: productIds },
      status: 'Active'
    });

    if (products.length !== productIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more products do not exist or are inactive.'
      });
    }

    const productMap = new Map(
      products.map(product => [product._id.toString(), product])
    );

    const saleItems = [];
    let subtotal = 0;

    for (const productId of productIds) {
      const product = productMap.get(productId);
      const quantity = quantityByProduct.get(productId);

      const mrp = Number(product.price);
      const discount = Number(product.discount || 0);

      if (
        !Number.isFinite(mrp) ||
        mrp <= 0 ||
        !Number.isFinite(discount) ||
        discount < 0 ||
        discount > 100
      ) {
        return res.status(400).json({
          success: false,
          message: `Invalid price or discount for ${product.name}.`
        });
      }

      const unitPrice = roundMoney(mrp * (1 - discount / 100));

      const options = lineOptions.get(productId);

      for (const option of options) {
        const lineSubtotal = roundMoney(unitPrice * option.quantity);

        saleItems.push({
          productId: product._id,
          productName: product.name,
          productCode: product.code,
          category: product.category || '',
          image: product.image || '',
          quantity: option.quantity,
          mrp,
          discount,
          unitPrice,
          subtotal: lineSubtotal,
          size: option.size,
          color: option.color
        });

        subtotal = roundMoney(subtotal + lineSubtotal);
      }
    }

    const totalAmount = roundMoney(subtotal);

    const received =
      amountReceived === undefined || amountReceived === ''
        ? totalAmount
        : Number(amountReceived);

    if (!Number.isFinite(received) || received < totalAmount) {
      return res.status(400).json({
        success: false,
        message: 'Amount received cannot be less than the sale total.',
        totalAmount
      });
    }

    if (received > totalAmount && paymentMethod !== 'cash') {
      return res.status(400).json({
        success: false,
        message: 'Change is only applicable to cash payments.'
      });
    }

    const saleId = generateBusinessId('OFF');

    // Create a processing record before changing inventory.
    sale = await OfflineSale.create({
      saleId,
      soldBy: req.user._id,
      customer: {
        name: customerName?.trim() || 'Walk-in Customer',
        mobile: customerMobile?.trim() || ''
      },
      items: saleItems,
      pricing: {
        subtotal,
        totalAmount,
        currency: 'INR'
      },
      payment: {
        method: paymentMethod,
        status: 'paid',
        amountReceived: received,
        changeGiven: roundMoney(received - totalAmount),
        reference:
          typeof paymentReference === 'string'
            ? paymentReference.trim()
            : '',
        paidAt: new Date()
      },
      status: 'processing',
      notes: notes?.trim() || ''
    });

    // Allocate physical inventory units, one by one.
    for (const productId of productIds) {
      const quantity = quantityByProduct.get(productId);

      affectedProductIds.add(productId);

      const availableCount = await Inventory.countDocuments({
        productId,
        status: 'available'
      });

      if (availableCount < quantity) {
        throw new Error(
          `Insufficient stock for ${productMap.get(productId).name}. Available: ${availableCount}, requested: ${quantity}.`
        );
      }

      for (let index = 0; index < quantity; index++) {
        const inventoryUnit = await Inventory.findOneAndUpdate(
          {
            productId,
            status: 'available'
          },
          {
            $set: {
              status: 'sold',
              soldAt: new Date(),
              soldBy: req.user._id,
              saleReference: saleId
            }
          },
          {
            new: true,
            sort: { createdAt: 1 }
          }
        );

        if (!inventoryUnit) {
          throw new Error(
            `Stock changed while processing ${productMap.get(productId).name}. Please try again.`
          );
        }

        changedInventoryIds.push(inventoryUnit._id);
      }
    }

    // Synchronize available stock for every affected product.
    for (const productId of affectedProductIds) {
      await syncProductStock(productId);
    }

    // Mark the offline sale completed.
    sale.status = 'completed';
    await sale.save();

    return res.status(201).json({
      success: true,
      message: 'Offline sale recorded successfully.',
      sale: {
        saleId: sale.saleId,
        status: sale.status,
        customer: sale.customer,
        items: sale.items,
        pricing: sale.pricing,
        payment: sale.payment,
        soldBy: sale.soldBy,
        createdAt: sale.createdAt
      }
    });
  } catch (error) {
    console.error('Create offline sale error:', error);

    // Restore any inventory units already marked as sold.
    if (changedInventoryIds.length > 0) {
      try {
        await Inventory.updateMany(
          {
            _id: { $in: changedInventoryIds },
            status: 'sold',
            saleReference: sale?.saleId
          },
          {
            $set: {
              status: 'available'
            },
            $unset: {
              soldAt: '',
              soldBy: '',
              saleReference: ''
            }
          }
        );

        for (const productId of affectedProductIds) {
          await syncProductStock(productId);
        }
      } catch (rollbackError) {
        console.error(
          'Offline sale inventory rollback failed:',
          rollbackError.message
        );
      }
    }

    // Remove an incomplete sale record.
    if (sale?._id) {
      try {
        await OfflineSale.deleteOne({ _id: sale._id });
      } catch (deleteError) {
        console.error(
          'Failed to remove incomplete offline sale:',
          deleteError.message
        );
      }
    }

    const stockIssue =
      /insufficient stock|stock changed/i.test(error.message);

    return res.status(stockIssue ? 409 : 500).json({
      success: false,
      message: stockIssue
        ? error.message
        : 'Unable to record offline sale.',
      error: error.message
    });
  }
};

// GET ALL OFFLINE SALES
export const getOfflineSales = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 10)
    );

    const filter = {
      status: 'completed'
    };

    if (req.query.paymentMethod) {
      filter['payment.method'] = req.query.paymentMethod;
    }

    if (req.query.soldBy && mongoose.Types.ObjectId.isValid(req.query.soldBy)) {
      filter.soldBy = req.query.soldBy;
    }

    if (req.query.search) {
      const search = new RegExp(
        escapeRegex(req.query.search.trim()),
        'i'
      );

      filter.$or = [
        { saleId: search },
        { 'customer.name': search },
        { 'customer.mobile': search }
      ];
    }

    const [sales, total] = await Promise.all([
      OfflineSale.find(filter)
        .populate('soldBy', 'userId name email role')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      OfflineSale.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      count: sales.length,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      sales
    });
  } catch (error) {
    console.error('Get offline sales error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch offline sales.'
    });
  }
};

// GET SINGLE OFFLINE SALE
export const getOfflineSaleDetails = async (req, res) => {
  try {
    const sale = await OfflineSale.findOne({
      saleId: req.params.saleId,
      status: 'completed'
    })
      .populate('soldBy', 'name email role')
      .populate('items.productId', 'name code image')
      .lean();

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Offline sale not found.'
      });
    }

    return res.status(200).json({
      success: true,
      sale
    });
  } catch (error) {
    console.error('Get offline sale details error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch offline sale details.'
    });
  }
};

// OFFLINE SALES SUMMARY
export const getOfflineSalesSummary = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [overall, today] = await Promise.all([
      OfflineSale.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: null,
            totalSales: { $sum: 1 },
            totalRevenue: { $sum: '$pricing.totalAmount' }
          }
        }
      ]),

      OfflineSale.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: startOfToday }
          }
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: 1 },
            totalRevenue: { $sum: '$pricing.totalAmount' }
          }
        }
      ])
    ]);

    return res.status(200).json({
      success: true,
      summary: {
        overall: overall[0] || {
          totalSales: 0,
          totalRevenue: 0
        },
        today: today[0] || {
          totalSales: 0,
          totalRevenue: 0
        }
      }
    });
  } catch (error) {
    console.error('Offline sales summary error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to generate offline sales summary.'
    });
  }
};
