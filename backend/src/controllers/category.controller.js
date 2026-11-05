import Category from '../models/Category.js';
import Product from '../models/Product.js';

import { generateBusinessId } from '../utils/generateId.js';
import { slugify } from '../utils/slugify.js';

// CREATE CATEGORY
export async function createCategory(req, res, next) {
  try {
    const {
      name,
      description = '',
      image = '',
      displayOrder = 0
    } = req.body;

    if (
      typeof name !== 'string' ||
      name.trim().length < 2
    ) {
      return res.status(400).json({
        success: false,
        message: 'Category name must contain at least 2 characters.'
      });
    }

    const slug = slugify(name);

    const existing = await Category.findOne({
      $or: [
        { name: name.trim() },
        { slug }
      ]
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Category already exists.'
      });
    }

    const category = await Category.create({
      categoryId: generateBusinessId('CAT'),
      name: name.trim(),
      slug,
      description,
      image,
      displayOrder,
      status: 'active'
    });

    return res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      category
    });

  } catch (error) {
    next(error);
  }
}

// GET ALL CATEGORIES
export async function getCategories(req, res, next) {
  try {
    const filter = {};

    // Public users see active categories only.
    // Admin can request all categories.
    if (req.user?.role !== 'admin') {
      filter.status = 'active';
    } else if (
      ['active', 'inactive'].includes(req.query.status)
    ) {
      filter.status = req.query.status;
    }

    const categories = await Category.find(filter)
      .sort({ displayOrder: 1, name: 1 });

    return res.json({
      success: true,
      count: categories.length,
      categories
    });

  } catch (error) {
    next(error);
  }
}

// GET SINGLE CATEGORY
export const getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;

    let category;

    // Check whether the supplied ID is a MongoDB ObjectId
    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      category = await Category.findById(id);
    } else {
      // Search using custom category ID or slug
      category = await Category.findOne({
        $or: [
          { categoryId: id },
          { slug: id }
        ]
      });
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.'
      });
    }

    return res.status(200).json({
      success: true,
      data: category
    });

  } catch (error) {
    next(error);
  }
};

// UPDATE CATEGORY
export async function updateCategory(req, res, next) {
  try {
    const category = await Category.findOne({
      categoryId: req.params.id
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.'
      });
    }

    const {
      name,
      description,
      image,
      status,
      displayOrder
    } = req.body;

    if (name !== undefined) {
      if (
        typeof name !== 'string' ||
        name.trim().length < 2
      ) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category name.'
        });
      }

      const newName = name.trim();
      const newSlug = slugify(newName);

      const duplicate = await Category.findOne({
        _id: { $ne: category._id },
        $or: [
          { name: newName },
          { slug: newSlug }
        ]
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: 'Category name already exists.'
        });
      }

      // Keep existing product category names in sync.
      await Product.updateMany(
        { categoryId: category._id },
        { $set: { category: newName } }
      );

      category.name = newName;
      category.slug = newSlug;
    }

    if (description !== undefined) {
      category.description = description;
    }

    if (image !== undefined) {
      category.image = image;
    }

    if (status !== undefined) {
      category.status = status;
    }

    if (displayOrder !== undefined) {
      category.displayOrder = displayOrder;
    }

    await category.save();

    return res.json({
      success: true,
      message: 'Category updated successfully.',
      category
    });

  } catch (error) {
    next(error);
  }
}

// DELETE CATEGORY
export async function deleteCategory(req, res, next) {
  try {
    const category = await Category.findOne({
      categoryId: req.params.id
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.'
      });
    }

    const productCount = await Product.countDocuments({
      categoryId: category._id
    });

    if (productCount > 0) {
      return res.status(409).json({
        success: false,
        message: 'This category contains products. Move or remove those products before deleting the category.'
      });
    }

    await category.deleteOne();

    return res.json({
      success: true,
      message: 'Category deleted successfully.'
    });

  } catch (error) {
    next(error);
  }
}

export async function getAdminCategories(req, res, next) {
  try {
    const categories = await Category.find({})
      .sort({ displayOrder: 1, createdAt: -1 });

    return res.json({
      success: true,
      count: categories.length,
      categories
    });

  } catch (error) {
    next(error);
  }
}