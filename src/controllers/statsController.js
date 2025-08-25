const User = require("../models/User");
const Order = require("../models/Order");

exports.getAdminStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalOrders = await Order.countDocuments();
    const nonOrderUsers = await User.countDocuments({
      _id: { $nin: await Order.distinct("userId") }
    });
    const nonDeliveredOrders = await Order.countDocuments({ status: { $ne: "delivered" } });
    // NEW: Total Revenue (only paid orders)
    const revenueAgg = await Order.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $group: { _id: null, totalRevenue: { $sum: "$total" } } }
    ]);
    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;

     const productsAgg = await Order.aggregate([
      { $unwind: "$items" },
      { $group: { _id: null, totalProducts: { $sum: "$items.quantity" } } }
    ]);
    const totalProducts = productsAgg[0]?.totalProducts || 0;



    res.json({
      totalUsers,
      totalOrders,
      nonOrderUsers,
      nonDeliveredOrders,
      totalRevenue,
      totalProducts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};