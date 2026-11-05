import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Inventory from '../models/Inventory.js';

import { generateBusinessId } from '../utils/generateId.js';
import { createInventoryUnits } from '../services/inventory.service.js';
import {
  uploadImage,
  deleteImage,
} from '../services/cloudinary.service.js';

// -------------------------
// PRICE HELPERS
// -------------------------

function calculateSellingPrice(price, deliveryCost, packingCost) {
  return Number(
    (
      Number(price) +
      Number(deliveryCost) +
      Number(packingCost)
    ).toFixed(2)
  );
}

function getCustomerPrice(product) {
  return Number(
    (
      product.price *
      (1 - product.discount / 100)
    ).toFixed(2)
  );
}

function serializeProduct(product) {
  const item = product.toObject
    ? product.toObject()
    : product;

  return {
    ...item,
    customerPrice: getCustomerPrice(item),
  };
}

// -------------------------
// INPUT HELPERS
// -------------------------

function parseArray(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      throw new Error(`${fieldName} must be a valid JSON array.`);
    }
  }

  throw new Error(`${fieldName} must be an array.`);
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;

  throw new Error('Invalid boolean value.');
}

function validateProductInput(body, isUpdate = false) {
  const errors = [];

  if (!isUpdate || body.name !== undefined) {
    if (
      typeof body.name !== 'string' ||
      body.name.trim().length < 2
    ) {
      errors.push('Product name must contain at least 2 characters.');
    }
  }

  if (!isUpdate || body.categoryId !== undefined) {
    if (
      typeof body.categoryId !== 'string' ||
      !body.categoryId.trim()
    ) {
      errors.push('Valid categoryId is required.');
    }
  }

  if (!isUpdate || body.price !== undefined) {
    const price = Number(body.price);

    if (!Number.isFinite(price) || price <= 0) {
      errors.push('MRP must be greater than zero.');
    }
  }

  if (!isUpdate || body.weight !== undefined) {
    const weight = Number(body.weight);

    if (!Number.isFinite(weight) || weight <= 0) {
      errors.push('Product weight must be greater than zero.');
    }
  }

  if (body.discount !== undefined) {
    const discount = Number(body.discount);

    if (
      !Number.isFinite(discount) ||
      discount < 0 ||
      discount > 100
    ) {
      errors.push('Discount must be between 0 and 100.');
    }
  }

  if (
    body.stock !== undefined &&
    (
      !Number.isInteger(Number(body.stock)) ||
      Number(body.stock) < 0
    )
  ) {
    errors.push('Stock must be a non-negative integer.');
  }

  if (
    body.code !== undefined &&
    (
      typeof body.code !== 'string' ||
      !/^[A-Z0-9_-]{3,40}$/i.test(body.code.trim())
    )
  ) {
    errors.push(
      'Product code must contain 3–40 letters, numbers, hyphens or underscores.'
    );
  }

  if (
    body.status !== undefined &&
    !['Active', 'Inactive'].includes(body.status)
  ) {
    errors.push('Invalid product status.');
  }

  if (
    body.weightUnit !== undefined &&
    !['g', 'kg'].includes(body.weightUnit)
  ) {
    errors.push('Weight unit must be g or kg.');
  }

  if (errors.length) return errors;

  return null;
}

// -------------------------
// CATEGORY HELPER
// -------------------------

async function findActiveCategory(categoryId) {
  const conditions = [
    { categoryId },
  ];

  if (/^[0-9a-fA-F]{24}$/.test(categoryId)) {
    conditions.push({ _id: categoryId });
  }

  return Category.findOne({
    $or: conditions,
    status: 'active',
  });
}

// -------------------------
// CLOUDINARY HELPERS
// -------------------------

async function uploadProductImages(req) {
  const uploaded = [];

  try {
    let mainImage = null;
    const additionalImages = [];

    const mainFile = req.files?.mainImage?.[0];

    if (mainFile) {
      mainImage = await uploadImage(
        mainFile.buffer,
        'hyni/products'
      );

      uploaded.push(mainImage);
    }

    const additionalFiles =
      req.files?.additionalImages || [];

    for (const file of additionalFiles) {
      const result = await uploadImage(
        file.buffer,
        'hyni/products'
      );

      additionalImages.push(result);
      uploaded.push(result);
    }

    return {
      mainImage,
      additionalImages,
      uploaded,
    };
  } catch (error) {
    await cleanupUploadedImages(uploaded);
    throw error;
  }
}

async function cleanupUploadedImages(images = []) {
  for (const image of images) {
    if (!image?.publicId) continue;

    try {
      await deleteImage(image.publicId);
    } catch (error) {
      console.error(
        'Cloudinary cleanup failed:',
        image.publicId,
        error.message
      );
    }
  }
}

async function cleanupOldImages(publicIds = []) {
  for (const publicId of publicIds) {
    if (!publicId) continue;

    try {
      await deleteImage(publicId);
    } catch (error) {
      // Database changes are already saved.
      // Log the failure so it can be cleaned up later.
      console.error(
        'Old Cloudinary image deletion failed:',
        publicId,
        error.message
      );
    }
  }
}

// -------------------------
// CREATE PRODUCT
// -------------------------

export async function createProduct(req, res, next) {
  let uploadedImages = [];

  try {
    const errors = validateProductInput(req.body);

    if (errors) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product details.',
        errors,
      });
    }

    const {
      name,
      code,
      categoryId,
      subcategory = '',
      price,
      discount = 0,
      weight,
      weightUnit = 'kg',
      deliveryCost = 0,
      packingCost = 0,
      stock = 0,
      lowStockThreshold = 5,
      fabric = '',
      status = 'Active',
    } = req.body;

    let sizes;
    let colors;
    let isNew;
    let hotSale;
    let featured;

    try {
      sizes = parseArray(req.body.sizes, 'sizes');
      colors = parseArray(req.body.colors, 'colors');

      isNew = parseBoolean(req.body.isNew);
      hotSale = parseBoolean(req.body.hotSale);
      featured = parseBoolean(req.body.featured);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    const category = await findActiveCategory(categoryId);

    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Selected category does not exist or is inactive.',
      });
    }

    const productCode = code
      ? code.trim().toUpperCase()
      : generateBusinessId('HYN');

    const existingCode = await Product.findOne({
      code: productCode,
    });

    if (existingCode) {
      return res.status(409).json({
        success: false,
        message: 'Product code already exists.',
      });
    }

    const initialStock = Number(stock);

    const sellingPrice = calculateSellingPrice(
      price,
      deliveryCost,
      packingCost
    );

    // Upload images to Cloudinary.
    const imageResult = await uploadProductImages(req);
    uploadedImages = imageResult.uploaded;

    // Optional legacy URL support.
    // New frontend uploads should use mainImage/additionalImages files.
    const mainImageUrl =
      imageResult.mainImage?.url || req.body.image || '';

    const additionalImageUrls = imageResult.additionalImages.map(
      (image) => image.url
    );

    const legacyImages = parseArray(
      req.body.images,
      'images'
    );

    const product = await Product.create({
      id: generateBusinessId('PRD'),
      name: name.trim(),
      code: productCode,

      categoryId: category._id,
      category: category.name,

      subcategory,

      price: Number(price),
      discount: Number(discount),

      weight: Number(weight),
      weightUnit,

      deliveryCost: Number(deliveryCost),
      packingCost: Number(packingCost),
      sellingPrice,

      stock: initialStock,
      lowStockThreshold: Number(lowStockThreshold),

      sizes,
      colors,
      fabric,

      isNew,
      hotSale,
      featured,

      status,

      image: mainImageUrl,
      imagePublicId: imageResult.mainImage?.publicId || '',

      images: [
        ...additionalImageUrls,
        ...legacyImages,
      ],
      imagePublicIds: imageResult.additionalImages.map(
        (image) => image.publicId
      ),
    });

    try {
      if (initialStock > 0) {
        await createInventoryUnits({
          productId: product._id,
          quantity: initialStock,
          addedBy: req.user._id,
          note: 'Initial product stock',
        });
      }
    } catch (inventoryError) {
      await Product.deleteOne({ _id: product._id });
      throw inventoryError;
    }

    return res.status(201).json({
      success: true,
      message: 'Product created successfully.',
      product: serializeProduct(product),
    });
  } catch (error) {
    await cleanupUploadedImages(uploadedImages);
    next(error);
  }
}

// -------------------------
// PUBLIC PRODUCT LIST
// -------------------------

export async function getProducts(req, res, next) {
  try {
    const {
      search = '',
      category = '',
      minPrice,
      maxPrice,
      sort = 'newest',
      page = 1,
      limit = 12,
      hotSale,
      isNew,
      featured,
    } = req.query;

    const currentPage = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(
      50,
      Math.max(1, Number(limit) || 12)
    );

    const filter = {
      status: 'Active',
    };

    if (category) {
      const categoryDoc = await Category.findOne({
        $or: [
          { slug: category },
          { categoryId: category },
        ],
        status: 'active',
      });

      if (!categoryDoc) {
        return res.json({
          success: true,
          products: [],
          pagination: {
            page: currentPage,
            limit: pageSize,
            total: 0,
            pages: 0,
          },
        });
      }

      filter.categoryId = categoryDoc._id;
    }

    if (search.trim()) {
      filter.$text = {
        $search: search.trim(),
      };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      const priceFilter = {};

      if (minPrice !== undefined) {
        priceFilter.$gte = Math.max(0, Number(minPrice));
      }

      if (maxPrice !== undefined) {
        priceFilter.$lte = Number(maxPrice);
      }

      filter.sellingPrice = priceFilter;
    }

    if (hotSale !== undefined) {
      filter.hotSale = hotSale === 'true';
    }

    if (isNew !== undefined) {
      filter.isNew = isNew === 'true';
    }

    if (featured !== undefined) {
      filter.featured = featured === 'true';
    }

    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      low: { sellingPrice: 1 },
      high: { sellingPrice: -1 },
      discount: { discount: -1 },
      popular: { sold: -1 },
    };

    const sortBy = sortOptions[sort] || sortOptions.newest;
    const skip = (currentPage - 1) * pageSize;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sortBy)
        .skip(skip)
        .limit(pageSize)
        .lean(),

      Product.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      products: products.map(serializeProduct),
      pagination: {
        page: currentPage,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
}

// -------------------------
// ADMIN PRODUCT LIST
// -------------------------

export async function getAdminProducts(req, res, next) {
  try {
    const {
      search = '',
      status = '',
      categoryId = '',
      page = 1,
      limit = 20,
    } = req.query;

    const currentPage = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number(limit) || 20)
    );

    const filter = {};

    if (search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { code: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    if (status && ['Active', 'Inactive'].includes(status)) {
      filter.status = status;
    }

    if (categoryId) {
      const category = await Category.findOne({
        $or: [
          { categoryId },
          ...( /^[0-9a-fA-F]{24}$/.test(categoryId)
            ? [{ _id: categoryId }]
            : [] ),
        ],
      });

      if (!category) {
        return res.json({
          success: true,
          products: [],
          pagination: {
            page: currentPage,
            limit: pageSize,
            total: 0,
            pages: 0,
          },
        });
      }

      filter.categoryId = category._id;
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * pageSize)
        .limit(pageSize),

      Product.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      products: products.map(serializeProduct),
      pagination: {
        page: currentPage,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
}

// -------------------------
// SINGLE PRODUCT DETAILS
// -------------------------

export async function getProductById(req, res, next) {
  try {
    const productId = req.params.id;

    const conditions = [
      { id: productId },
      { code: productId.toUpperCase() },
    ];

    if (/^[0-9a-fA-F]{24}$/.test(productId)) {
      conditions.push({ _id: productId });
    }

    const product = await Product.findOne({
      $or: conditions,
      status: 'Active',
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    return res.json({
      success: true,
      product: serializeProduct(product),
    });
  } catch (error) {
    next(error);
  }
}

// -------------------------
// UPDATE PRODUCT
// -------------------------

export async function updateProduct(req, res, next) {
  let uploadedImages = [];

  try {
    const errors = validateProductInput(req.body, true);

    if (errors) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product details.',
        errors,
      });
    }

    const product = await Product.findOne({
      id: req.params.id,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    const oldImagesToDelete = [];

    const allowedFields = [
      'name',
      'code',
      'subcategory',
      'price',
      'discount',
      'weight',
      'weightUnit',
      'deliveryCost',
      'packingCost',
      'lowStockThreshold',
      'fabric',
      'status',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    }

    try {
      if (req.body.sizes !== undefined) {
        product.sizes = parseArray(req.body.sizes, 'sizes');
      }

      if (req.body.colors !== undefined) {
        product.colors = parseArray(req.body.colors, 'colors');
      }

      if (req.body.isNew !== undefined) {
        product.isNew = parseBoolean(req.body.isNew);
      }

      if (req.body.hotSale !== undefined) {
        product.hotSale = parseBoolean(req.body.hotSale);
      }

      if (req.body.featured !== undefined) {
        product.featured = parseBoolean(req.body.featured);
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (req.body.code !== undefined) {
      product.code = req.body.code.trim().toUpperCase();

      const duplicateCode = await Product.findOne({
        code: product.code,
        _id: { $ne: product._id },
      });

      if (duplicateCode) {
        return res.status(409).json({
          success: false,
          message: 'Product code already exists.',
        });
      }
    }

    if (req.body.categoryId !== undefined) {
      const category = await findActiveCategory(
        req.body.categoryId
      );

      if (!category) {
        return res.status(400).json({
          success: false,
          message: 'Selected category does not exist or is inactive.',
        });
      }

      product.categoryId = category._id;
      product.category = category.name;
    }

    // Upload any newly selected files.
    const imageResult = await uploadProductImages(req);
    uploadedImages = imageResult.uploaded;

    // Replace main image only when a new main image is uploaded.
    if (imageResult.mainImage) {
      if (product.imagePublicId) {
        oldImagesToDelete.push(product.imagePublicId);
      }

      product.image = imageResult.mainImage.url;
      product.imagePublicId = imageResult.mainImage.publicId;
    }

    // Remove selected additional images.
    let removeImagePublicIds = [];

    try {
      removeImagePublicIds = parseArray(
        req.body.removeImagePublicIds,
        'removeImagePublicIds'
      );
    } catch (error) {
      await cleanupUploadedImages(uploadedImages);

      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (removeImagePublicIds.length > 0) {
      const remainingImages = [];
      const remainingPublicIds = [];

      const currentImages = product.images || [];
      const currentPublicIds = product.imagePublicIds || [];

      currentImages.forEach((url, index) => {
        const publicId = currentPublicIds[index];

        if (
          publicId &&
          removeImagePublicIds.includes(publicId)
        ) {
          oldImagesToDelete.push(publicId);
        } else {
          remainingImages.push(url);

          if (publicId) {
            remainingPublicIds.push(publicId);
          }
        }
      });

      product.images = remainingImages;
      product.imagePublicIds = remainingPublicIds;
    }

    // Optionally replace the entire additional-image gallery.
    const replaceAdditionalImages =
      req.body.replaceAdditionalImages === 'true' ||
      req.body.replaceAdditionalImages === true;

    if (
      replaceAdditionalImages &&
      imageResult.additionalImages.length === 0
    ) {
      await cleanupUploadedImages(uploadedImages);

      return res.status(400).json({
        success: false,
        message: 'Upload at least one additional image when replacing the gallery.',
      });
    }

    if (replaceAdditionalImages) {
      oldImagesToDelete.push(...(product.imagePublicIds || []));

      product.images = imageResult.additionalImages.map(
        (image) => image.url
      );

      product.imagePublicIds = imageResult.additionalImages.map(
        (image) => image.publicId
      );
    } else if (imageResult.additionalImages.length > 0) {
      const currentImages = product.images || [];
      const currentPublicIds = product.imagePublicIds || [];

      const totalImages =
        currentImages.length +
        imageResult.additionalImages.length;

      if (totalImages > 5) {
        await cleanupUploadedImages(uploadedImages);

        return res.status(400).json({
          success: false,
          message: 'A product can have a maximum of 5 additional images.',
        });
      }

      product.images = [
        ...currentImages,
        ...imageResult.additionalImages.map((image) => image.url),
      ];

      product.imagePublicIds = [
        ...currentPublicIds,
        ...imageResult.additionalImages.map(
          (image) => image.publicId
        ),
      ];
    }

    // Explicitly remove the main image if requested.
    if (
      req.body.removeMainImage === 'true' ||
      req.body.removeMainImage === true
    ) {
      if (product.imagePublicId) {
        oldImagesToDelete.push(product.imagePublicId);
      }

      product.image = '';
      product.imagePublicId = '';
    }

    // Stock is managed separately through Inventory APIs.
    // Never update stock directly from this endpoint.

    product.sellingPrice = calculateSellingPrice(
      product.price,
      product.deliveryCost,
      product.packingCost
    );

    await product.save();

    // Delete old images only after the database update succeeds.
    await cleanupOldImages([
      ...new Set(oldImagesToDelete),
    ]);

    return res.json({
      success: true,
      message: 'Product updated successfully.',
      product: serializeProduct(product),
    });
  } catch (error) {
    await cleanupUploadedImages(uploadedImages);
    next(error);
  }
}

// -------------------------
// SOFT DELETE PRODUCT
// -------------------------

export async function deleteProduct(req, res, next) {
  try {
    const product = await Product.findOne({
      id: req.params.id,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    const available = await Inventory.countDocuments({
      productId: product._id,
      status: 'available',
    });

    if (available > 0) {
      return res.status(409).json({
        success: false,
        message:
          'This product has available inventory. Remove or reassign its stock before deactivating it.',
      });
    }

    product.status = 'Inactive';

    await product.save();

    return res.json({
      success: true,
      message: 'Product deactivated successfully.',
    });
  } catch (error) {
    next(error);
  }
}