
import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
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
    itemSubtotal: {
      type: Number,
      required: true
    },
    packingCost: {
      type: Number,
      default: 0
    },
    weightKg: {
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

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: String,
    mobile: String,
    addressLine1: String,
    addressLine2: String,
    landmark: String,
    city: String,
    state: String,
    pincode: String,
    country: String,
    label: String
  },
  { _id: false }
);

const orderStatusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: [
        'pending_payment',
        'payment_verification',
        'confirmed',
        'processing',
        'shipped',
        'delivered',
        'cancelled'
      ],
      required: true
    },
    note: {
      type: String,
      default: ''
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    changedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);
const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    customerDetails: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      mobile: { type: String, default: '' },
      role: {
        type: String,
        enum: ['customer', 'wholesale'],
        required: true
      }
    },

    items: {
      type: [orderItemSchema],
      required: true
    },

    shippingAddress: {
      type: shippingAddressSchema,
      required: true
    },

    pricing: {
      subtotal: { type: Number, required: true },
      totalWeightKg: { type: Number, required: true },
      chargeableWeightKg: { type: Number, required: true },
      packingCost: { type: Number, required: true },
      shippingCharge: { type: Number, required: true },
      finalAmount: { type: Number, required: true },
      currency: {
        type: String,
        default: 'INR'
      }
    },

    payment: {
      method: {
        type: String,
        enum: ['UPI'],
        default: 'UPI'
      },
      status: {
  type: String,
  enum: [
    'pending',
    'submitted',
    'verifying',
    'expiring',
    'verified',
    'rejected',
    'expired'
  ],
  default: 'pending'
},
verificationMethod: {
  type: String,
  enum: ['proof_upload', 'manual_admin'],
  default: null
},
verificationNote: {
  type: String,
  default: ''
},
      receiverUpiId: {
        type: String,
        default: ''
      },
      receiverName: {
        type: String,
        default: ''
      },
      utrNumber: {
        type: String,
        default: ''
      },
      screenshotUrl: {
        type: String,
        default: ''
      },
      screenshotPublicId: {
        type: String,
        default: ''
      },
      submittedAt: {
        type: Date,
        default: null
      },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      verifiedAt: {
        type: Date,
        default: null
      },
      rejectionReason: {
        type: String,
        default: ''
      }
    },

    status: {
      type: String,
      enum: [
        'pending_payment',
        'payment_verification',
        'confirmed',
        'processing',
        'shipped',
        'delivered',
        'cancelled'
      ],
      default: 'pending_payment',
      index: true
    },

    inventoryReservedAt: {
      type: Date,
      default: null
    },

    reservationExpiresAt: {
      type: Date,
      default: null
    },

    trackingId: {
      type: String,
      default: ''
    },

    courierName: {
      type: String,
      default: ''
    },

    notes: {
      type: String,
      default: ''
    },

    shippedAt: {
  type: Date,
  default: null
},

deliveredAt: {
  type: Date,
  default: null
},

statusHistory: {
  type: [orderStatusHistorySchema],
  default: []
},
  },
  { timestamps: true }
);

orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'payment.status': 1, createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);

export default Order;
