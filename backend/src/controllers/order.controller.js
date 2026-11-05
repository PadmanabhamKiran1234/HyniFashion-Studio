
import Order from '../models/Order.js';

const escapeRegex = value =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// CUSTOMER: Get logged-in customer's orders
export const getMyOrders = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 10)
    );

    const filter = {
      customerId: req.user._id
    };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .select(
          'orderId items pricing payment.method payment.status status trackingId courierName shippedAt deliveredAt createdAt updatedAt'
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      Order.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      count: orders.length,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      orders
    });
  } catch (error) {
    console.error('Get customer orders error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch your orders.'
    });
  }
};

// CUSTOMER: Get one order belonging to the logged-in customer
export const getMyOrderDetails = async (req, res) => {
  try {
    const order = await Order.findOne({
      orderId: req.params.orderId,
      customerId: req.user._id
    }).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    return res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Get customer order details error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch order details.'
    });
  }
};

// ADMIN: Get all orders with search, filters and pagination
export const getAllOrders = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 10)
    );

    const filter = {};

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.paymentStatus) {
      filter['payment.status'] = req.query.paymentStatus;
    }

    if (req.query.search) {
      const search = escapeRegex(req.query.search.trim());
      const searchRegex = new RegExp(search, 'i');

      filter.$or = [
        { orderId: searchRegex },
        { 'customerDetails.name': searchRegex },
        { 'customerDetails.email': searchRegex },
        { 'customerDetails.mobile': searchRegex }
      ];
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('customerId', 'name email mobile role')
        .lean(),

      Order.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      count: orders.length,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      orders
    });
  } catch (error) {
    console.error('Get all orders error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch orders.'
    });
  }
};

// ADMIN: Get individual order details
export const getAdminOrderDetails = async (req, res) => {
  try {
    const order = await Order.findOne({
      orderId: req.params.orderId
    })
      .populate('customerId', 'name email mobile role')
      .populate('payment.verifiedBy', 'name email')
      .populate('statusHistory.updatedBy', 'name email')
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    return res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Get admin order details error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch order details.'
    });
  }
};

// ADMIN: Update order status
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, note, courierName, trackingId } = req.body;

    const allowedTransitions = {
      confirmed: ['processing'],
      processing: ['shipped'],
      shipped: ['delivered']
    };

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'New order status is required.'
      });
    }

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    if (order.payment.status !== 'verified') {
      return res.status(400).json({
        success: false,
        message: 'Only orders with verified payments can be processed.'
      });
    }

    const allowedNextStatuses = allowedTransitions[order.status] || [];

    if (!allowedNextStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${order.status} to ${status}.`
      });
    }

    const update = {
      status,
      statusHistory: [
        ...order.statusHistory,
        {
          status,
          note: typeof note === 'string' ? note.trim() : '',
          updatedBy: req.user._id,
          changedAt: new Date()
        }
      ]
    };

    if (status === 'shipped') {
      if (
        typeof courierName !== 'string' ||
        !courierName.trim() ||
        typeof trackingId !== 'string' ||
        !trackingId.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: 'Courier name and tracking ID are required before shipping.'
        });
      }

      update.courierName = courierName.trim();
      update.trackingId = trackingId.trim();
      update.shippedAt = new Date();
    }

    if (status === 'delivered') {
      update.deliveredAt = new Date();
    }

    // Use the current status in the query to prevent concurrent updates.
    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        status: order.status,
        'payment.status': 'verified'
      },
      {
        $set: {
          status: update.status,
          ...(update.courierName && {
            courierName: update.courierName
          }),
          ...(update.trackingId && {
            trackingId: update.trackingId
          }),
          ...(update.shippedAt && {
            shippedAt: update.shippedAt
          }),
          ...(update.deliveredAt && {
            deliveredAt: update.deliveredAt
          })
        },
        $push: {
          statusHistory: update.statusHistory[update.statusHistory.length - 1]
        }
      },
      { new: true, runValidators: true }
    );

    if (!updatedOrder) {
      return res.status(409).json({
        success: false,
        message: 'Order status changed during this request. Refresh and try again.'
      });
    }

    return res.status(200).json({
      success: true,
      message: `Order status updated to ${status}.`,
      order: updatedOrder
    });
  } catch (error) {
    console.error('Update order status error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to update order status.',
      error: error.message
    });
  }
};

// ADMIN: Update courier or tracking details for an already shipped order
export const updateOrderTracking = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { courierName, trackingId } = req.body;

    if (
      typeof courierName !== 'string' ||
      !courierName.trim() ||
      typeof trackingId !== 'string' ||
      !trackingId.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Courier name and tracking ID are required.'
      });
    }

    const order = await Order.findOneAndUpdate(
      {
        orderId,
        status: 'shipped'
      },
      {
        $set: {
          courierName: courierName.trim(),
          trackingId: trackingId.trim()
        }
      },
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Shipped order not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Tracking details updated successfully.',
      order: {
        orderId: order.orderId,
        courierName: order.courierName,
        trackingId: order.trackingId,
        status: order.status
      }
    });
  } catch (error) {
    console.error('Update tracking details error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to update tracking details.'
    });
  }
};
