
import Order from '../models/Order.js';

// 1. Initial chatbot greeting
export const startChatbot = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Hi! How are you? How may I help you?',
    options: [
      {
        label: 'Order Details',
        value: 'order_details'
      },
      {
        label: 'Others',
        value: 'others'
      }
    ]
  });
};

// 2. Customer selects Order Details
export const getOrderOptions = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Please select an option:',
    options: [
      {
        label: 'Previous Orders',
        value: 'previous_orders'
      },
      {
        label: 'Current Order',
        value: 'current_order'
      }
    ]
  });
};

// 3. Customer selects Previous Orders
export const getPreviousOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      customerId: req.user._id
    })
      .select(
        'orderId items.productName items.quantity pricing.finalAmount status payment.status createdAt'
      )
      .sort({ createdAt: -1 })
      .lean();

    if (orders.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'You have not placed any orders yet.',
        count: 0,
        orders: []
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Here are your orders:',
      count: orders.length,
      orders: orders.map(order => ({
        orderId: order.orderId,
        items: order.items,
        totalAmount: order.pricing?.finalAmount ?? 0,
        orderStatus: order.status,
        paymentStatus: order.payment?.status,
        orderDate: order.createdAt
      }))
    });
  } catch (error) {
    console.error('Chatbot previous orders error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve your previous orders.'
    });
  }
};

// 4. Customer selects Current Order
export const askCurrentOrderId = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Please enter your Order ID to view your order details.',
    input: {
      label: 'Order ID',
      placeholder: 'Example: HYN4356477A',
      name: 'orderId'
    }
  });
};

// 5. Customer enters an Order ID
export const getCurrentOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId || !orderId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid Order ID.'
      });
    }

    // Only return orders belonging to the logged-in customer.
    const order = await Order.findOne({
      orderId: orderId.trim(),
      customerId: req.user._id
    })
      .select(
        'orderId items.productName items.productCode items.quantity items.image items.size items.color pricing.finalAmount status payment.status courierName trackingId shippedAt deliveredAt createdAt'
      )
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'We could not find this order. Please check your Order ID.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Here are your order details.',
      order: {
        orderId: order.orderId,
        items: order.items,
        totalAmount: order.pricing?.finalAmount ?? 0,
        orderStatus: order.status,
        paymentStatus: order.payment?.status,
        courierName: order.courierName || '',
        trackingId: order.trackingId || '',
        shippedAt: order.shippedAt || null,
        deliveredAt: order.deliveredAt || null,
        orderDate: order.createdAt
      },
      trackButton: {
        label: 'Track Order',
        // enabled: order.status === 'shipped' || order.status === 'delivered',
        enabled: true,
        trackingPath: `/track-order/${encodeURIComponent(order.orderId)}`
      }
    });
  } catch (error) {
    console.error('Chatbot current order error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve this order.'
    });
  }
};

// 6. Customer selects Others
export const getOtherSupport = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Please contact the owner for more details.',
    support: {
      mobile: process.env.ADMIN_SUPPORT_MOBILE || '9999999999'
    }
  });
};
