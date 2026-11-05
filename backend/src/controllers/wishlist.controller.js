import mongoose from 'mongoose';
import Wishlist from '../models/Wishlist.js';
import Product from '../models/Product.js';

// Find product using MongoDB ID, product ID or product code
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

// Get or create wishlist
const getOrCreateWishlist = async (customerId) => {
  let wishlist = await Wishlist.findOne({ customerId });

  if (!wishlist) {
    try {
      wishlist = await Wishlist.create({
        customerId,
        products: []
      });
    } catch (error) {
      if (error.code === 11000) {
        wishlist = await Wishlist.findOne({ customerId });
      } else {
        throw error;
      }
    }
  }

  return wishlist;
};

// GET CUSTOMER WISHLIST
export const getWishlist = async (req, res) => {
  try {
    const wishlist = await getOrCreateWishlist(req.user._id);

    await wishlist.populate({
      path: 'products',
      select: 'id name code category price sellingPrice discount image images stock status sizes colors'
    });

    return res.status(200).json({
      success: true,
      message: 'Wishlist fetched successfully.',
      data: {
        _id: wishlist._id,
        products: wishlist.products,
        itemCount: wishlist.products.length,
        updatedAt: wishlist.updatedAt
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to fetch wishlist.',
      error: error.message
    });
  }
};

// ADD PRODUCT TO WISHLIST
export const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required.'
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

    const wishlist = await getOrCreateWishlist(req.user._id);

    const alreadyExists = wishlist.products.some(
      (id) => id.toString() === product._id.toString()
    );

    if (alreadyExists) {
      return res.status(409).json({
        success: false,
        message: 'Product is already in your wishlist.'
      });
    }

    wishlist.products.push(product._id);

    await wishlist.save();

    await wishlist.populate({
      path: 'products',
      select: 'id name code category price sellingPrice discount image images stock status sizes colors'
    });

    return res.status(200).json({
      success: true,
      message: 'Product added to wishlist.',
      data: {
        products: wishlist.products,
        itemCount: wishlist.products.length
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to add product to wishlist.',
      error: error.message
    });
  }
};

// REMOVE PRODUCT FROM WISHLIST
export const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await findProduct(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    const wishlist = await Wishlist.findOne({
      customerId: req.user._id
    });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found.'
      });
    }

    const existingCount = wishlist.products.length;

    wishlist.products = wishlist.products.filter(
      (id) => id.toString() !== product._id.toString()
    );

    if (wishlist.products.length === existingCount) {
      return res.status(404).json({
        success: false,
        message: 'Product is not in your wishlist.'
      });
    }

    await wishlist.save();

    return res.status(200).json({
      success: true,
      message: 'Product removed from wishlist.',
      data: {
        itemCount: wishlist.products.length
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to remove product from wishlist.',
      error: error.message
    });
  }
};

// CLEAR ENTIRE WISHLIST
export const clearWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({
      customerId: req.user._id
    });

    if (!wishlist) {
      return res.status(200).json({
        success: true,
        message: 'Wishlist is already empty.'
      });
    }

    wishlist.products = [];

    await wishlist.save();

    return res.status(200).json({
      success: true,
      message: 'Wishlist cleared successfully.',
      data: {
        itemCount: 0
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to clear wishlist.',
      error: error.message
    });
  }
};