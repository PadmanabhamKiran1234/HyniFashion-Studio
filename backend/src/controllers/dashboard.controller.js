
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Inventory from '../models/Inventory.js';
import OfflineSale from '../models/OfflineSale.js';

export const getDashboardSummary = async (req, res) => {
  try {
    const [
      totalProducts,
      activeProducts,
      totalCategories,
      totalCustomers,
      totalWholesale,
      pendingWholesale,
      totalEmployees,
      activeEmployees,
      totalOrders,
      pendingPayments,
      paymentsUnderVerification,
      verifiedPayments,
      orderStatuses,
      inventoryStatuses,
      lowStockProducts,
      onlineRevenue,
      offlineRevenue,
      offlineSalesCount,
      totalPiecesResult
    ] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ status: 'Active' }),
      Category.countDocuments(),

      User.countDocuments({ role: 'customer' }),
      User.countDocuments({ role: 'wholesale' }),
      User.countDocuments({
        role: 'wholesale',
        status: 'pending'
      }),

      User.countDocuments({ role: 'employee' }),
      User.countDocuments({
        role: 'employee',
        status: 'active'
      }),

      Order.countDocuments(),

      Order.countDocuments({
        'payment.status': 'pending'
      }),
      Order.countDocuments({
        'payment.status': { $in: ['submitted', 'verifying'] }
      }),
      Order.countDocuments({
        'payment.status': 'verified'
      }),

      Order.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),

      Inventory.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),

      Product.countDocuments({
        status: 'Active',
        $expr: {
          $lte: ['$stock', '$lowStockThreshold']
        }
      }),

      Order.aggregate([
        {
          $match: {
            'payment.status': 'verified'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$pricing.finalAmount' }
          }
        }
      ]),

      OfflineSale.aggregate([
        {
          $match: { status: 'completed' }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$pricing.totalAmount' }
          }
        }
      ]),

      OfflineSale.countDocuments({ status: 'completed' }),

      // Total sellable pieces: available inventory units belonging to active
      // products only. Reserved/sold units are never counted.
      Inventory.aggregate([
        { $match: { status: 'available' } },
        {
          $lookup: {
            from: 'products',
            localField: 'productId',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: '$product' },
        { $match: { 'product.status': 'Active' } },
        { $count: 'total' }
      ])
    ]);

    const statusCounts = {};
    orderStatuses.forEach((item) => {
      statusCounts[item._id] = item.count;
    });

    const inventoryCounts = {};
    inventoryStatuses.forEach((item) => {
      inventoryCounts[item._id] = item.count;
    });

    const onlineSales = onlineRevenue[0]?.total || 0;
    const offlineSales = offlineRevenue[0]?.total || 0;
    const totalPieces = totalPiecesResult[0]?.total || 0;

    return res.status(200).json({
      success: true,
      message: 'Dashboard summary fetched successfully',

      data: {
        products: {
          total: totalProducts,
          active: activeProducts,
          inactive: totalProducts - activeProducts
        },

        categories: {
          total: totalCategories
        },

        customers: {
          total: totalCustomers
        },

        wholesale: {
          total: totalWholesale,
          pending: pendingWholesale
        },

        employees: {
          total: totalEmployees,
          active: activeEmployees
        },

        orders: {
          total: totalOrders,
          byStatus: statusCounts
        },

        payments: {
          pending: pendingPayments,
          underVerification: paymentsUnderVerification,
          verified: verifiedPayments
        },

        inventory: {
          available: inventoryCounts.available || 0,
          reserved: inventoryCounts.reserved || 0,
          sold: inventoryCounts.sold || 0,
          removed: inventoryCounts.removed || 0,
          lowStockProducts,
          totalPieces
        },

        sales: {
          onlineRevenue: Number(onlineSales.toFixed(2)),
          offlineRevenue: Number(offlineSales.toFixed(2)),
          totalRevenue: Number(
            (onlineSales + offlineSales).toFixed(2)
          ),
          completedOfflineSales: offlineSalesCount,
          currency: 'INR'
        }
      }
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard summary'
    });
  }
};


export const getDashboardSalesTrend = async (req, res) => {
  try {
    const days = Math.min(
      Math.max(parseInt(req.query.days, 10) || 7, 1),
      90
    );

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (days - 1));

    const [onlineSales, offlineSales] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            'payment.status': 'verified',
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt'
              }
            },
            revenue: { $sum: '$pricing.finalAmount' },
            orders: { $sum: 1 }
          }
        }
      ]),

      OfflineSale.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt'
              }
            },
            revenue: { $sum: '$pricing.totalAmount' },
            sales: { $sum: 1 }
          }
        }
      ])
    ]);

    const trend = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      const dateKey = date.toISOString().slice(0, 10);

      const online = onlineSales.find(
        (item) => item._id === dateKey
      );

      const offline = offlineSales.find(
        (item) => item._id === dateKey
      );

      const onlineRevenue = online?.revenue || 0;
      const offlineRevenue = offline?.revenue || 0;

      trend.push({
        date: dateKey,
        onlineRevenue: Number(onlineRevenue.toFixed(2)),
        offlineRevenue: Number(offlineRevenue.toFixed(2)),
        totalRevenue: Number(
          (onlineRevenue + offlineRevenue).toFixed(2)
        ),
        onlineOrders: online?.orders || 0,
        offlineSales: offline?.sales || 0
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Sales trend fetched successfully',
      data: {
        days,
        currency: 'INR',
        trend
      }
    });
  } catch (error) {
    console.error('Dashboard sales trend error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch sales trend'
    });
  }
};
