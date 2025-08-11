const express = require("express");
const { getAllProductsForUser, 
    addToCart, 
    addToWishlist, 
    getCartItems, 
    getWishlistItems,
    updateCartItemQuantity,
    removeFromCart,
    clearCart,
    removeFromWishlist, 
    getPopularBrands} = require("../controllers/customerController");
const verifyToken = require("../middlewares/authMiddleware");

const router = express.Router();

//users without login also can can access cuz no verify token
router.get("/products", getAllProductsForUser);

router.post("/cart", verifyToken, addToCart);
router.get("/cart", verifyToken, getCartItems);
router.put("/cart", verifyToken, updateCartItemQuantity); // For quantity updates
router.delete("/cart/:productId", verifyToken, removeFromCart); // For removing items
router.delete("/cart", verifyToken, clearCart)

router.post("/wishlist", verifyToken, addToWishlist);
router.get("/wishlist", verifyToken, getWishlistItems);
router.delete("/wishlist/:productId", verifyToken, removeFromWishlist);


module.exports = router;

