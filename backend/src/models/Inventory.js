
import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema(
  {
    inventoryId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },

    status: {
      type: String,
      enum: [
        'available',
        'reserved',
        'sold',
        'removed'
      ],
      default: 'available',
      index: true
    },

    reservedForOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true
    },

    reservedAt: {
      type: Date,
      default: null
    },

    reservationExpiresAt: {
      type: Date,
      default: null,
      index: true
    },

    soldAt: {
      type: Date,
      default: null
    },

    soldBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    saleReference: {
      type: String,
      default: ''
    },

    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    note: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

inventorySchema.index({
  productId: 1,
  status: 1
});

inventorySchema.index({
  reservedForOrder: 1,
  status: 1
});

const Inventory = mongoose.model(
  'Inventory',
  inventorySchema
);

export default Inventory;
