import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },

    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true
    },

    // Kept for compatibility with your existing React frontend
    category: {
      type: String,
      required: true,
      trim: true
    },

    subcategory: {
      type: String,
      default: '',
      trim: true
    },

    // Existing frontend uses price
    // We treat price as the MRP.
    price: {
      type: Number,
      required: true,
      min: 0
    },

    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },

    weight: {
      type: Number,
      required: true,
      min: 0.001
    },

    weightUnit: {
      type: String,
      enum: ['g', 'kg'],
      default: 'kg'
    },

    // Calculated and cached by backend
    deliveryCost: {
      type: Number,
      default: 0,
      min: 0
    },

    packingCost: {
      type: Number,
      default: 0,
      min: 0
    },

    sellingPrice: {
      type: Number,
      default: 0,
      min: 0
    },

    stock: {
      type: Number,
      default: 0,
      min: 0
    },

    lowStockThreshold: {
      type: Number,
      default: 5,
      min: 0
    },

    sizes: {
      type: [String],
      default: []
    },

    colors: {
      type: [String],
      default: []
    },

    fabric: {
      type: String,
      default: ''
    },

    isNew: {
      type: Boolean,
      default: false
    },

    hotSale: {
      type: Boolean,
      default: false
    },

    featured: {
      type: Boolean,
      default: false
    },

    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
      index: true
    },

    image: {
  type: String,
  default: '',
},

imagePublicId: {
  type: String,
  default: '',
},

images: {
  type: [String],
  default: [],
},

imagePublicIds: {
  type: [String],
  default: [],
},

    sold: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

productSchema.index({
  name: 'text',
  code: 'text',
  category: 'text',
  subcategory: 'text'
});

productSchema.index({
  categoryId: 1,
  status: 1,
  createdAt: -1
});

const Product = mongoose.model(
  'Product',
  productSchema
);

export default Product;