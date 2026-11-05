import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    userId: {
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

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },

    mobile: {
      type: String,
      trim: true,
      default: ''
    },

    password: {
      type: String,
      required: true,
      select: false
    },

    role: {
      type: String,
      enum: [
        'admin',
        'customer',
        'wholesale',
        'employee'
      ],
      required: true,
      index: true
    },

    status: {
      type: String,
      enum: [
        'active',
        'pending',
        'suspended'
      ],
      default: 'active',
      index: true
    },

    employeeDetails: {
      department: {
        type: String,
        trim: true,
        default: ''
      },

      designation: {
        type: String,
        trim: true,
        default: ''
      },

      joiningDate: {
        type: Date,
        default: null
      }
    },

    approvedAt: {
      type: Date,
      default: null
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    permissions: {
  type: [String],
  enum: [
    'dashboard.view',
    'products.view',
    'products.manage',
    'inventory.view',
    'inventory.manage',
    'orders.view',
    'orders.manage',
    'customers.view',
    'offlineSales.view',
    'offlineSales.manage'
  ],
  default: []
},
  
  
  },
  {
    timestamps: true
  }
);

// Never expose password in API responses
userSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    userId: this.userId,
    name: this.name,
    email: this.email,
    mobile: this.mobile,
    role: this.role,
    status: this.status,
    permissions: this.permissions || [],
    employeeDetails: this.employeeDetails,
    createdAt: this.createdAt
  };
};

const User = mongoose.model('User', userSchema);

export default User;