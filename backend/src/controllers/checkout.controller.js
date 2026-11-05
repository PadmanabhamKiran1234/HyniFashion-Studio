
import mongoose from 'mongoose';

import Cart from '../models/Cart.js';
import Address from '../models/Address.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';

import { calculateCheckoutPricing } from '../services/checkoutPricing.service.js';
import { generateUpiPaymentQR } from '../services/upi.service.js';

import {
  reserveOrderInventory,
  releaseOrderInventory
} from '../services/order.service.js';

import { generateBusinessId } from '../utils/generateId.js';
import { validateWholesaleMinimum } from '../utils/wholesaleValidation.js';

export const previewCheckout = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({
      customerId: req.user._id
    }).populate({
      path: 'items.productId',
      select: 'id name code category price discount weight weightUnit packingCost deliveryCost status image'
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your shopping cart is empty.'
      });
    }

    const pricing = calculateCheckoutPricing(cart);

    if (req.user.role === 'wholesale') {
      const wholesaleCheck = validateWholesaleMinimum(
        pricing.summary.subtotal
      );

      return res.status(200).json({
        success: true,
        checkout: pricing,
        wholesaleValidation: wholesaleCheck
      });
    }

    return res.status(200).json({
      success: true,
      checkout: pricing
    });
  } catch (error) {
    next(error);
  }
};

export const createOrder = async (req, res, next) => {
  let createdOrder = null;
  let reservationStarted = false;

  try {
    const { addressId } = req.body;

    if (!mongoose.isValidObjectId(addressId)) {
      return res.status(400).json({
        success: false,
        message: 'Please select a valid delivery address.'
      });
    }

    const address = await Address.findOne({
      _id: addressId,
      customerId: req.user._id
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Delivery address not found.'
      });
    }

    const cart = await Cart.findOne({
      customerId: req.user._id
    }).populate({
      path: 'items.productId',
      select: 'id name code price discount weight weightUnit packingCost status image'
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your shopping cart is empty.'
      });
    }

    const pricing = calculateCheckoutPricing(cart);

    if (req.user.role === 'wholesale') {
      const wholesaleCheck = validateWholesaleMinimum(
        pricing.summary.subtotal
      );

      if (!wholesaleCheck.eligible) {
        return res.status(400).json({
          success: false,
          message: wholesaleCheck.message,
          data: wholesaleCheck
        });
      }
    }

    for (const item of pricing.items) {
      const product = await Product.findOne({
        _id: item.productId,
        status: 'Active'
      });

      if (!product) {
        return res.status(400).json({
          success: false,
          message: `${item.productName} is no longer available.`
        });
      }
    }

    const orderId = generateBusinessId('HYN');
    const now = new Date();

    const reservationExpiresAt = new Date(
      now.getTime() + 30 * 60 * 1000
    );

    createdOrder = await Order.create({
      orderId,
      customerId: req.user._id,

      customerDetails: {
        name: req.user.name,
        email: req.user.email,
        mobile: req.user.mobile || '',
        role: req.user.role
      },

      items: pricing.items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        productCode: item.productCode,
        quantity: item.quantity,
        mrp: item.mrp,
        discount: item.discount,
        unitPrice: item.unitPrice,
        itemSubtotal: item.itemSubtotal,
        packingCost: item.packingCost,
        weightKg: item.weightKg,
        size: item.size || '',
        color: item.color || '',
        image: ''
      })),

      shippingAddress: {
        label: address.label,
        fullName: address.fullName,
        mobile: address.mobile,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        landmark: address.landmark,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        country: address.country
      },

      pricing: pricing.summary,

      payment: {
        method: 'UPI',
        status: 'pending'
      },

      status: 'pending_payment',
      inventoryReservedAt: now,
      reservationExpiresAt
    });

    reservationStarted = true;
    await reserveOrderInventory(createdOrder);

    const paymentQR = await generateUpiPaymentQR({
      amount: pricing.summary.finalAmount,
      orderReference: orderId,
      note: `Hyni Order ${orderId}`
    });

    createdOrder.payment.receiverUpiId = paymentQR.upiId;
    createdOrder.payment.receiverName = paymentQR.receiverName;

    await createdOrder.save();

    cart.items = [];
    await cart.save();

    return res.status(201).json({
      success: true,
      message: 'Order created. Please complete UPI payment.',
      order: {
        orderId: createdOrder.orderId,
        status: createdOrder.status,
        paymentStatus: createdOrder.payment.status,
        pricing: createdOrder.pricing,
        shippingAddress: createdOrder.shippingAddress
      },
      payment: {
        method: 'UPI',
        amount: paymentQR.amount,
        currency: paymentQR.currency,
        receiverName: paymentQR.receiverName,
        receiverUpiId: paymentQR.upiId,
        orderReference: paymentQR.orderReference,
        qrCode: paymentQR.qrCode
      }
    });

  } catch (error) {
    if (createdOrder) {
      if (reservationStarted) {
        try {
          await releaseOrderInventory(createdOrder._id);
        } catch (rollbackError) {
          console.error('Inventory rollback failed:', rollbackError.message);
        }
      }

      try {
        await Order.deleteOne({
          _id: createdOrder._id,
          status: 'pending_payment',
          'payment.status': 'pending'
        });
      } catch (deleteError) {
        console.error('Order rollback failed:', deleteError.message);
      }
    }

    next(error);
  }
};
