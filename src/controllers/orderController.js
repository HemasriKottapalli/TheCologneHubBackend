const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const Order = require('../models/Order');
const Product = require('../models/Product');

const orderController = {
  // Get all orders for authenticated user
 getOrders: async (req, res) => {
    try {
      const userId = req.user.id;
      const { status, search, page = 1, limit = 20 } = req.query;

      console.log('📡 getOrders called with userId:', userId, 'params:', { status, search, page, limit });

      // Build filter query
      let filterQuery = { userId };

      // Filter by status if provided
      if (status && status !== 'all') {
        filterQuery.status = status;
      }

      // Build search query for order ID or product names
      if (search && search.trim()) {
        const searchTerm = search.trim();
        filterQuery.$or = [
          { orderId: { $regex: searchTerm, $options: 'i' } },
          { 'items.productName': { $regex: searchTerm, $options: 'i' } }
        ];
      }

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Get orders with pagination
      const orders = await Order.find(filterQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Get total count for pagination
      const totalOrders = await Order.countDocuments(filterQuery);

      // Enhance orders with product images and details
      const enhancedOrders = await Promise.all(
        orders.map(async (order) => {
          const enhancedItems = await Promise.all(
            order.items.map(async (item) => {
              try {
                const product = await Product.findOne({ product_id: item.productId })
                  .select('image_url name brand')
                  .lean();
                
                return {
                  productId: item.productId,
                  name: product?.name || item.productName,
                  brand: product?.brand || 'Unknown Brand',
                  quantity: item.quantity,
                  price: item.price,
                  image: product?.image_url || null,
                  size: '100ml' // Default size, you can make this dynamic
                };
              } catch (error) {
                return {
                  productId: item.productId,
                  name: item.productName,
                  brand: 'Unknown Brand',
                  quantity: item.quantity,
                  price: item.price,
                  image: null,
                  size: '100ml'
                };
              }
            })
          );

          // Updated shipping address string
          const addr = order.shippingAddress;
          const shippingStr = `${addr.addressLine1}${addr.addressLine2 ? `, ${addr.addressLine2}` : ''}, ${addr.city}, ${addr.state} ${addr.zipCode}`;

          return {
            id: order._id,
            orderId: order.orderId,
            date: order.createdAt,
            status: order.status,
            total: order.total,
            items: enhancedItems,
            shippingAddress: shippingStr,
            trackingNumber: order.trackingNumber || null,
            estimatedDelivery: order.estimatedDelivery,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus
          };
        })
      );

      // Get status counts for filter pills
      const statusCounts = await getOrderStatusCounts(userId);

      console.log('✅ Sending response with orders:', enhancedOrders.length, 'statusCounts:', statusCounts);

      res.json({
        success: true,
        orders: enhancedOrders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalOrders / parseInt(limit)),
          totalOrders,
          hasNextPage: skip + enhancedOrders.length < totalOrders,
          hasPrevPage: parseInt(page) > 1
        },
        statusCounts
      });

    } catch (error) {
      console.error('❌ Error fetching orders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch orders'
      });
    }
  },

  // Get specific order details
  getOrderById: async (req, res) => {
    try {
      const userId = req.user.id;
      const { orderId } = req.params;

      const order = await Order.findOne({ 
        _id: orderId, 
        userId 
      }).lean();

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      // Enhance order with product details
      const enhancedItems = await Promise.all(
        order.items.map(async (item) => {
          try {
            const product = await Product.findOne({ product_id: item.productId })
              .select('image_url name brand description')
              .lean();
            
            return {
              productId: item.productId,
              name: product?.name || item.productName,
              brand: product?.brand || 'Unknown Brand',
              quantity: item.quantity,
              price: item.price,
              totalPrice: item.totalPrice,
              image: product?.image_url || null,
              description: product?.description || '',
              size: '100ml'
            };
          } catch (error) {
            return {
              productId: item.productId,
              name: item.productName,
              brand: 'Unknown Brand',
              quantity: item.quantity,
              price: item.price,
              totalPrice: item.totalPrice,
              image: null,
              description: '',
              size: '100ml'
            };
          }
        })
      );

      const enhancedOrder = {
        id: order._id,
        orderId: order.orderId,
        date: order.createdAt,
        status: order.status,
        total: order.total,
        subtotal: order.subtotal,
        shipping: order.shipping,
        tax: order.tax,
        promoDiscount: order.promoDiscount,
        promoCode: order.promoCode,
        items: enhancedItems,
        shippingAddress: order.shippingAddress,
        trackingNumber: order.trackingNumber,
        estimatedDelivery: order.estimatedDelivery,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        notes: order.notes
      };

      res.json({
        success: true,
        order: enhancedOrder
      });

    } catch (error) {
      console.error('Error fetching order details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch order details'
      });
    }
  },

  // Cancel an order
  cancelOrder: async (req, res) => {
    try {
      const userId = req.user.id;
      const { orderId } = req.params;
      const { reason } = req.body;

      const order = await Order.findOne({ 
        _id: orderId, 
        userId 
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      // Check if order can be cancelled
      if (!['pending', 'confirmed'].includes(order.status)) {
        return res.status(400).json({
          success: false,
          message: 'Order cannot be cancelled at this stage'
        });
      }

      // Update order status
      order.status = 'cancelled';
      order.notes = reason || 'Cancelled by customer';
      await order.save();

      // Restore stock if order was confirmed
      if (order.status === 'confirmed') {
        for (const item of order.items) {
          await Product.findOneAndUpdate(
            { product_id: item.productId },
            { $inc: { stock_quantity: item.quantity } }
          );
        }
      }

      res.json({
        success: true,
        message: 'Order cancelled successfully',
        orderId: order.orderId
      });

    } catch (error) {
      console.error('Error cancelling order:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel order'
      });
    }
  },

  // Get all non-delivered orders
  getNonDeliveredOrders: async (req, res) => {
    try {
      const orders = await Order.find({ status: { $ne: "delivered" } }).sort({ createdAt: -1 });
      res.json(orders);
    } catch (err) {
      res.status(500).json({ error: "Server error while fetching non-delivered orders" });
    }
  },

  // Get all delivered orders
  getDeliveredOrders: async (req, res) => {
    try {
      const orders = await Order.find({ status: "delivered" }).sort({ deliveredAt: -1 });
      res.json(orders);
    } catch (err) {
      res.status(500).json({ error: "Server error while fetching delivered orders" });
    }
  },

  // Get all cancelled orders
  getCancelledOrders: async (req, res) => {
    try {
      const orders = await Order.find({ status: "cancelled" }).sort({ updatedAt: -1 });
      res.json(orders);
    } catch (err) {
      res.status(500).json({ error: "Server error while fetching cancelled orders" });
    }
  },

  // Update order status
  updateOrderStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { newStatus } = req.body;

      if (!newStatus) {
        return res.status(400).json({ error: "newStatus field is required" });
      }

      const order = await Order.findById(id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Update status
      order.status = newStatus;

      if (newStatus === "confirmed" && !order.confirmedAt) {
        order.confirmedAt = new Date();
      }

      if (newStatus === "delivered") {
        order.deliveredAt = new Date();
      }

      await order.save();

      res.json({ message: "Order status updated successfully", order });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error while updating order status" });
    }
  },

  // Get orders by status
  getOrdersByStatus: async (req, res) => {
    try {
      const { status } = req.params;

      // if status = all → return all orders
      let filter = {};
      if (status !== "all") {
        filter.status = status;
      }

      const orders = await Order.find(filter).sort({ createdAt: -1 });
      res.json(orders);
    } catch (err) {
      res.status(500).json({ error: "Server error while fetching orders by status" });
    }
  },

  // Get counts of all statuses
  getOrderCounts: async (req, res) => {
    try {
      const statuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
      const counts = {};

      for (let s of statuses) {
        counts[s] = await Order.countDocuments({ status: s });
      }

      res.json(counts);
    } catch (err) {
      res.status(500).json({ error: "Server error while fetching order counts" });
    }
  },

  // Get orders for a specific user
  getUserOrders: async (req, res) => {
    try {
      const { userId } = req.params;

      const orders = await Order.find({ userId })
        .sort({ createdAt: -1 }) // latest first
        .select('orderId status total items orderDate'); // pick fields

      res.status(200).json(orders);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Export today's orders
  exportTodayOrders: async (req, res) => {
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const end = new Date();
      end.setHours(23, 59, 59, 999);

      const orders = await Order.find({ orderDate: { $gte: start, $lte: end } });

      if (!orders.length) {
        return res.status(404).json({ message: "No orders found for today" });
      }

      await exportOrdersToExcel(orders, res, "today_orders");
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error exporting orders" });
    }
  },

  // Export orders for a given date
  exportOrdersByDate: async (req, res) => {
    try {
      const date = new Date(req.params.date); // yyyy-mm-dd
      if (isNaN(date)) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      }

      const start = new Date(date.setHours(0, 0, 0, 0));
      const end = new Date(date.setHours(23, 59, 59, 999));

      const orders = await Order.find({ orderDate: { $gte: start, $lte: end } });

      if (!orders.length) {
        return res.status(404).json({ message: "No orders found on this date" });
      }

      await exportOrdersToExcel(orders, res, `orders_${req.params.date}`);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error exporting orders" });
    }
  }
};

// Helper function to get status counts
async function getOrderStatusCounts(userId) {
  console.log('🔍 getOrderStatusCounts called with userId:', userId);

  // Ensure userId is a valid ObjectId or string as stored in the database
  let userIdQuery;
  try {
    userIdQuery = mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;
  } catch (err) {
    console.error('❌ Invalid userId format:', userId, err);
    return {
      all: 0,
      pending: 0,
      confirmed: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0
    };
  }

  try {
    const pipeline = [
      { $match: { userId: userIdQuery } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { status: '$_id', count: 1, _id: 0 } }
    ];

    const results = await Order.aggregate(pipeline);
    
    console.log('📊 Aggregation result:', results);

    const counts = {
      all: 0,
      pending: 0,
      confirmed: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0
    };

    // Calculate total and individual counts
    results.forEach(result => {
      if (result.status in counts) {
        counts[result.status] = result.count;
        counts.all += result.count;
      } else {
        console.warn(`⚠️ Unexpected status found: ${result.status}`);
      }
    });

    console.log('✅ Final statusCounts:', counts);
    return counts;
  } catch (error) {
    console.error('❌ Error getting status counts:', error);
    return {
      all: 0,
      pending: 0,
      confirmed: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0
    };
  }
}

// Helper function for exporting to Excel
async function exportOrdersToExcel(orders, res, fileName) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Orders");

  worksheet.columns = [
    { header: "Order ID", key: "orderId", width: 20 },
    { header: "User ID", key: "userId", width: 30 },
    { header: "Status", key: "status", width: 15 },
    { header: "Payment Status", key: "paymentStatus", width: 15 },
    { header: "Subtotal", key: "subtotal", width: 15 },
    { header: "Discount", key: "promoDiscount", width: 15 },
    { header: "Shipping", key: "shipping", width: 15 },
    { header: "Tax", key: "tax", width: 15 },
    { header: "Total", key: "total", width: 15 },
    { header: "Order Date", key: "orderDate", width: 25 }
  ];

  orders.forEach(order => {
    worksheet.addRow({
      orderId: order.orderId,
      userId: order.userId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      subtotal: order.subtotal,
      promoDiscount: order.promoDiscount,
      shipping: order.shipping,
      tax: order.tax,
      total: order.total,
      orderDate: order.orderDate.toISOString().slice(0, 19).replace("T", " ")
    });
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=${fileName}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
}

module.exports = orderController;