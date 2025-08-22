const mongoose = require('mongoose');
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

          return {
            id: order._id,
            orderId: order.orderId,
            date: order.createdAt,
            status: order.status,
            total: order.total,
            items: enhancedItems,
            shippingAddress: `${order.shippingAddress.address}, ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}`,
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

module.exports = orderController;