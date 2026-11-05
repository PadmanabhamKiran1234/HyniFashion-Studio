import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    categoryId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    description: {
      type: String,
      default: '',
      maxlength: 1000
    },

    image: {
      type: String,
      default: ''
    },

    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true
    },

    displayOrder: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

const Category = mongoose.model(
  'Category',
  categorySchema
);

export default Category;