
import User from '../models/User.js';

// GET CUSTOMER PROFILE
export async function getCustomerProfile(req, res, next) {
  try {
    const customer = await User.findOne({
      _id: req.user._id,
      role: { $in: ['customer', 'wholesale'] }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer account not found.'
      });
    }

    return res.json({
      success: true,
      message: 'Customer profile fetched successfully.',
      customer: customer.toSafeObject()
    });

  } catch (error) {
    next(error);
  }
}

// UPDATE CUSTOMER PROFILE
// ADMIN: LIST CUSTOMER AND WHOLESALE ACCOUNTS
export async function getAdminCustomers(req, res, next) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));

    const filter = {
      role: { $in: ['customer', 'wholesale'] }
    };

    if (['customer', 'wholesale'].includes(req.query.role)) {
      filter.role = req.query.role;
    }

    if (['active', 'pending', 'suspended'].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    if (req.query.search && req.query.search.trim()) {
      const search = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { name: regex },
        { email: regex },
        { mobile: regex },
        { userId: regex }
      ];
    }

    const [customers, total] = await Promise.all([
      User.find(filter)
        .select('userId name email mobile role status approvedAt createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      User.countDocuments(filter)
    ]);

    return res.json({
      success: true,
      count: customers.length,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      customers
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCustomerProfile(req, res, next) {
  try {
    const { name, mobile } = req.body;

    const updates = {};

    if (name !== undefined) {
      if (
        typeof name !== 'string' ||
        name.trim().length < 2 ||
        name.trim().length > 100
      ) {
        return res.status(400).json({
          success: false,
          message: 'Name must contain between 2 and 100 characters.'
        });
      }

      updates.name = name.trim();
    }

    if (mobile !== undefined) {
      if (
        typeof mobile !== 'string' ||
        !/^[0-9]{10,15}$/.test(mobile.trim())
      ) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid mobile number (10–15 digits).'
        });
      }

      updates.mobile = mobile.trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one valid field to update.'
      });
    }

    const customer = await User.findOneAndUpdate(
      {
        _id: req.user._id,
        role: { $in: ['customer', 'wholesale'] }
      },
      {
        $set: updates
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer account not found.'
      });
    }

    return res.json({
      success: true,
      message: 'Customer profile updated successfully.',
      customer: customer.toSafeObject()
    });

  } catch (error) {
    next(error);
  }
}
