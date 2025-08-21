const express = require("express");
const { 
  getAllProductsForUser, 
  addToCart, 
  addToWishlist, 
  getCartItems, 
  getWishlistItems,
  updateCartItemQuantity,
  removeFromCart,
  clearCart,
  removeFromWishlist
} = require("../controllers/customerController");

// Import payment controller
const paymentController = require("../controllers/paymentController");
const verifyToken = require("../middlewares/authMiddleware");

const router = express.Router();

// Existing routes (users without login also can access cuz no verify token)
router.get("/products", getAllProductsForUser);

// Cart routes
router.post("/cart", verifyToken, addToCart);
router.get("/cart", verifyToken, getCartItems);
router.put("/cart", verifyToken, updateCartItemQuantity);
router.delete("/cart/:productId", verifyToken, removeFromCart);
router.delete("/cart", verifyToken, clearCart);

// Wishlist routes
router.post("/wishlist", verifyToken, addToWishlist);
router.get("/wishlist", verifyToken, getWishlistItems);
router.delete("/wishlist/:productId", verifyToken, removeFromWishlist);

// Payment routes
router.post("/create-payment-intent", verifyToken, paymentController.createPaymentIntent);
router.post("/confirm-payment", verifyToken, paymentController.confirmPayment);
router.get("/order/:orderId", verifyToken, paymentController.getOrder);


module.exports = router;