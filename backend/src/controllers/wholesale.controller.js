import Cart from '../models/Cart.js';
import Inventory from '../models/Inventory.js';
import { validateWholesaleMinimum } from '../utils/wholesaleValidation.js';

export const validateWholesaleCheckout = async (req, res) => {
  try {
    // Verify wholesale account status
    if (req.user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your wholesale account is not approved or active.'
      });
    }

    // Get customer's cart
    const cart = await Cart.findOne({
      customerId: req.user._id
    }).populate('items.productId');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your shopping cart is empty.'
      });
    }

    let subtotal = 0;
    const unavailableProducts = [];

    // Check each product and calculate subtotal from database prices
    for (const item of cart.items) {
      const product = item.productId;

      if (!product || product.status !== 'Active') {
        unavailableProducts.push({
          product: product?.name || 'Unknown product',
          reason: 'Product is unavailable.'
        });
        continue;
      }

      const availableStock = await Inventory.countDocuments({
        productId: product._id,
        status: 'available'
      });

      if (item.quantity > availableStock) {
        unavailableProducts.push({
          product: product.name,
          requestedQuantity: item.quantity,
          availableStock,
          reason: 'Insufficient stock.'
        });
        continue;
      }

      const sellingPrice = Number(
        product.sellingPrice ?? product.price ?? 0
      );

      const discount = Number(product.discount || 0);

      const customerPrice = Number(
        (sellingPrice * (1 - discount / 100)).toFixed(2)
      );

      subtotal += customerPrice * item.quantity;
    }

    subtotal = Number(subtotal.toFixed(2));

    // Stop if any cart product is unavailable
    if (unavailableProducts.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Some products in your cart are unavailable.',
        unavailableProducts,
        subtotal
      });
    }

    // Check wholesale minimum order amount
    const validation = validateWholesaleMinimum(subtotal);

    if (!validation.eligible) {
      return res.status(400).json({
        success: false,
        message: validation.message,
        data: validation
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Wholesale checkout eligibility verified.',
      data: {
        eligible: true,
        minimumOrder: validation.minimumOrder,
        subtotal,
        remainingAmount: 0,
        itemCount: cart.items.reduce(
          (total, item) => total + item.quantity,
          0
        )
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to validate wholesale checkout.',
      error: error.message
    });
  }
};