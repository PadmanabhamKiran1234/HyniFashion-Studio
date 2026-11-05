import mongoose from 'mongoose';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';

// Resolve product using MongoDB ID, product ID or product code
const findProduct = async (identifier) => {
  let product = null;

  if (mongoose.isValidObjectId(identifier)) {
    product = await Product.findById(identifier);
  }

  if (!product) {
    product = await Product.findOne({
      $or: [
        { id: identifier },
        { code: String(identifier).toUpperCase() }
      ]
    });
  }

  return product;
};

// Get currently available stock from individual inventory records
const getAvailableStock = async (productId) => {
  return Inventory.countDocuments({
    productId,
    status: 'available'
  });
};

// Calculate customer price
const getCustomerPrice = (product) => {
  const basePrice = Number(product.price ?? product.sellingPrice ?? 0);
  const discount = Number(product.discount || 0);

  return Number(
    (basePrice * (1 - discount / 100)).toFixed(2)
  );
};

// Prepare cart response with current product details and totals
const formatCart = (cart) => {
  let subtotal = 0;

  const items = cart.items.map((item) => {
    const product = item.productId;

    if (!product) {
      return null;
    }

    const unitPrice = getCustomerPrice(product);
    const itemTotal = Number(
      (unitPrice * item.quantity).toFixed(2)
    );

    subtotal += itemTotal;

    return {
      cartItemId: item._id,
      product: {
        _id: product._id,
        id: product.id,
        name: product.name,
        code: product.code,
        image: product.image,
        price: product.price,
        sellingPrice: product.sellingPrice,
        discount: product.discount,
        customerPrice: unitPrice,
        stock: product.stock,
        status: product.status
      },
      quantity: item.quantity,
      size: item.size,
      color: item.color,
      itemTotal
    };
  }).filter(Boolean);

  subtotal = Number(subtotal.toFixed(2));

  return {
    _id: cart._id,
    customerId: cart.customerId,
    items,
    itemCount: items.reduce(
      (total, item) => total + item.quantity,
      0
    ),
    subtotal,
    total: subtotal,
    updatedAt: cart.updatedAt
  };
};

// Get or create customer's cart
const getOrCreateCart = async (customerId) => {
  let cart = await Cart.findOne({ customerId });

  if (!cart) {
    try {
      cart = await Cart.create({
        customerId,
        items: []
      });
    } catch (error) {
      // Handle simultaneous cart creation requests
      if (error.code === 11000) {
        cart = await Cart.findOne({ customerId });
      } else {
        throw error;
      }
    }
  }

  return cart;
};

// GET CUSTOMER CART
export const getCart = async (req, res) => {
  try {
    const cart = await getOrCreateCart(req.user._id);

    await cart.populate('items.productId');

    return res.status(200).json({
      success: true,
      message: 'Cart fetched successfully.',
      data: formatCart(cart)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to fetch cart.',
      error: error.message
    });
  }
};

// ADD PRODUCT TO CART
export const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1, size = '', color = '' } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required.'
      });
    }

    const count = Number(quantity);

    if (!Number.isSafeInteger(count) || count < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive whole number.'
      });
    }

    const product = await findProduct(String(productId));

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    if (product.status !== 'Active') {
      return res.status(400).json({
        success: false,
        message: 'This product is currently unavailable.'
      });
    }

    // Validate selected size
    if (size && !product.sizes.includes(size)) {
      return res.status(400).json({
        success: false,
        message: 'Selected size is not available.'
      });
    }

    // Validate selected color
    if (color && !product.colors.includes(color)) {
      return res.status(400).json({
        success: false,
        message: 'Selected color is not available.'
      });
    }

    const availableStock = await getAvailableStock(product._id);

    const cart = await getOrCreateCart(req.user._id);

    const existingItem = cart.items.find((item) => {
      return (
        item.productId.toString() === product._id.toString() &&
        item.size === size &&
        item.color === color
      );
    });

    const existingQuantity = existingItem
      ? existingItem.quantity
      : 0;

    if (existingQuantity + count > availableStock) {
      return res.status(400).json({
        success: false,
        message: `Only ${availableStock} unit(s) are currently available.`,
        availableStock
      });
    }

    if (existingItem) {
      existingItem.quantity += count;
    } else {
      cart.items.push({
        productId: product._id,
        quantity: count,
        size,
        color
      });
    }

    await cart.save();
    await cart.populate('items.productId');

    return res.status(200).json({
      success: true,
      message: 'Product added to cart successfully.',
      data: formatCart(cart)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to add product to cart.',
      error: error.message
    });
  }
};

// UPDATE CART ITEM QUANTITY
export const updateCartItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    const count = Number(quantity);

    if (!Number.isSafeInteger(count) || count < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive whole number.'
      });
    }

    const product = await findProduct(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    if (product.status !== 'Active') {
      return res.status(400).json({
        success: false,
        message: 'This product is currently unavailable.'
      });
    }

    const cart = await Cart.findOne({
      customerId: req.user._id
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found.'
      });
    }

    const item = cart.items.find(
      (entry) =>
        entry.productId.toString() === product._id.toString() &&
        entry._id.toString() === req.body.cartItemId
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found.'
      });
    }

    const availableStock = await getAvailableStock(product._id);

    if (count > availableStock) {
      return res.status(400).json({
        success: false,
        message: `Only ${availableStock} unit(s) are currently available.`,
        availableStock
      });
    }

    item.quantity = count;

    await cart.save();
    await cart.populate('items.productId');

    return res.status(200).json({
      success: true,
      message: 'Cart quantity updated successfully.',
      data: formatCart(cart)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to update cart quantity.',
      error: error.message
    });
  }
};

// REMOVE INDIVIDUAL PRODUCT FROM CART
export const removeCartItem = async (req, res) => {
  try {
    const { cartItemId } = req.params;

    if (!mongoose.isValidObjectId(cartItemId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid cart item ID.'
      });
    }

    const cart = await Cart.findOne({
      customerId: req.user._id
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found.'
      });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item._id.toString() === cartItemId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found.'
      });
    }

    cart.items.splice(itemIndex, 1);

    await cart.save();
    await cart.populate('items.productId');

    return res.status(200).json({
      success: true,
      message: 'Product removed from cart.',
      data: formatCart(cart)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to remove cart item.',
      error: error.message
    });
  }
};

// CLEAR ENTIRE CART
export const clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({
      customerId: req.user._id
    });

    if (!cart) {
      return res.status(200).json({
        success: true,
        message: 'Cart is already empty.'
      });
    }

    cart.items = [];

    await cart.save();

    return res.status(200).json({
      success: true,
      message: 'Cart cleared successfully.',
      data: formatCart(cart)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to clear cart.',
      error: error.message
    });
  }
};