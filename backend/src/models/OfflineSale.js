import mongoose from 'mongoose';

const offlineSaleItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    productName: {
      type: String,
      required: true
    },
    productCode: {
      type: String,
      required: true
    },
    category: {
      type: String,
      default: ''
    },
    image: {
      type: String,
      default: ''
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    mrp: {
      type: Number,
      required: true
    },
    discount: {
      type: Number,
      default: 0
    },
    unitPrice: {
      type: Number,
      required: true
    },
    subtotal: {
      type: Number,
      required: true
    },
    size: {
      type: String,
      default: ''
    },
    color: {
      type: String,
      default: ''
    }
  },
  { _id: false }
);

const offlineSaleSchema = new mongoose.Schema(
  {
    saleId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    soldBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    customer: {
      name: {
        type: String,
        default: 'Walk-in Customer'
      },
      mobile: {
        type: String,
        default: ''
      }
    },

    items: {
      type: [offlineSaleItemSchema],
      required: true
    },

    pricing: {
      subtotal: {
        type: Number,
        required: true
      },
      totalAmount: {
        type: Number,
        required: true
      },
      currency: {
        type: String,
        default: 'INR'
      }
    },

    payment: {
      method: {
        type: String,
        enum: ['cash', 'upi', 'card', 'other'],
        required: true
      },
      status: {
        type: String,
        enum: ['paid'],
        default: 'paid'
      },
      amountReceived: {
        type: Number,
        required: true,
        min: 0
      },
      changeGiven: {
        type: Number,
        default: 0
      },
      reference: {
        type: String,
        default: ''
      },
      paidAt: {
        type: Date,
        default: Date.now
      }
    },

    status: {
      type: String,
      enum: ['processing', 'completed'],
      default: 'processing',
      index: true
    },

    notes: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

offlineSaleSchema.index({ createdAt: -1 });
offlineSaleSchema.index({ 'customer.mobile': 1 });
offlineSaleSchema.index({ payment: 1, createdAt: -1 });

const OfflineSale = mongoose.model('OfflineSale', offlineSaleSchema);

export default OfflineSale;