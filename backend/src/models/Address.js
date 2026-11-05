
import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    label: {
      type: String,
      enum: ['Home', 'Work', 'Other'],
      default: 'Home'
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    mobile: {
      type: String,
      required: true,
      trim: true
    },

    addressLine1: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },

    addressLine2: {
      type: String,
      trim: true,
      default: '',
      maxlength: 200
    },

    landmark: {
      type: String,
      trim: true,
      default: '',
      maxlength: 100
    },

    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    state: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    pincode: {
      type: String,
      required: true,
      trim: true,
      match: /^[0-9]{6}$/
    },

    country: {
      type: String,
      default: 'India',
      trim: true
    },

    isDefault: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

addressSchema.index({ customerId: 1, createdAt: -1 });

const Address = mongoose.model('Address', addressSchema);

export default Address;
