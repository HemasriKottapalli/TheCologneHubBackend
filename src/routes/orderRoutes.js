const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const verifyToken = require("../middlewares/authMiddleware");
const authorizeRoles = require("../middlewares/roleMiddleware");

// Routes
router.get("/non-delivered", verifyToken,authorizeRoles("admin"),orderController.getNonDeliveredOrders);
router.get("/delivered",verifyToken, authorizeRoles("admin"),orderController.getDeliveredOrders);
router.get("/cancelled",verifyToken, authorizeRoles("admin"),orderController.getCancelledOrders);
router.patch("/:id/status", verifyToken,authorizeRoles("admin"),orderController.updateOrderStatus);
router.get("/status/:status",verifyToken, authorizeRoles("admin"),orderController.getOrdersByStatus);
router.get("/counts",verifyToken, authorizeRoles("admin"),orderController.getOrderCounts);
router.get('/:userId/orders', verifyToken,authorizeRoles("admin"),orderController.getUserOrders);
router.get("/export/today",verifyToken,authorizeRoles("admin"), orderController.exportTodayOrders);
router.get("/export/date/:date",verifyToken,authorizeRoles("admin"), orderController.exportOrdersByDate);


module.exports = router;