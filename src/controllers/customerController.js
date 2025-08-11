const Product = require("../models/Product");
const Cart = require("../models/Cart");
const Wishlist = require("../models/Wishlist");
const Category = require('../models/Category');
const Brand = require("../models/Brand");

const getAllProductsForUser = async (req, res) => {
  try {
    const products = await Product.find({});
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch products", error });
  }
};

const getCartItems = async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id });
    
    if (!cart) {
      return res.status(200).json({ items: [] });
    }

    // Manually populate products using product_id
    const populatedItems = await Promise.all(
      cart.items.map(async (item) => {
        const product = await Product.findOne({ product_id: item.productId });
        return {
          productId: item.productId,
          quantity: item.quantity,
          product: product
        };
      })
    );

    res.status(200).json({ 
      ...cart.toObject(), 
      items: populatedItems 
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ message: "Failed to fetch cart items", error: error.message });
  }
};

const addToWishlist = async (req, res) => {
  const { productId } = req.body; // This will be product_id string
  const userId = req.user.id;

  try {
    // Find product by product_id instead of _id
    const product = await Product.findOne({ product_id: productId });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = new Wishlist({ userId, products: [productId] });
    } else {
      if (!wishlist.products.includes(productId)) {
        wishlist.products.push(productId);
      } else {
        return res.status(200).json({ message: "Product already in wishlist", wishlist });
      }
    }

    await wishlist.save();
    res.status(200).json({ message: "Product added to wishlist successfully", wishlist });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    res.status(500).json({ message: "Failed to add to wishlist", error: error.message });
  }
};

const getWishlistItems = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ userId: req.user.id });
    
    if (!wishlist) {
      return res.status(200).json({ products: [] });
    }

    // Manually populate products using product_id
    const populatedProducts = await Promise.all(
      wishlist.products.map(async (productId) => {
        return await Product.findOne({ product_id: productId });
      })
    );

    res.status(200).json({ 
      ...wishlist.toObject(), 
      products: populatedProducts.filter(p => p !== null) // Remove null products
    });
  } catch (error) {
    console.error('Get wishlist error:', error);
    res.status(500).json({ message: "Failed to fetch wishlist", error: error.message });
  }
};

const updateCartItemQuantity = async (req, res) => {
  const { productId, quantity } = req.body;
  const userId = req.user.id;

  try {
    // Find product to verify it exists
    const product = await Product.findOne({ product_id: productId });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check stock availability
    if (quantity > product.stock_quantity) {
      return res.status(400).json({ 
        message: "Insufficient stock", 
        availableStock: product.stock_quantity 
      });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const itemIndex = cart.items.findIndex(item => item.productId === productId);
    if (itemIndex === -1) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    cart.items[itemIndex].quantity = quantity;
    await cart.save();

    res.status(200).json({ message: "Cart updated successfully", cart });
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({ message: "Failed to update cart", error: error.message });
  }
};

const removeFromCart = async (req, res) => {
  const { productId } = req.params;
  const userId = req.user.id;

  try {
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    cart.items = cart.items.filter(item => item.productId !== productId);
    await cart.save();

    res.status(200).json({ message: "Item removed from cart successfully", cart });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ message: "Failed to remove item from cart", error: error.message });
  }
};

const clearCart = async (req, res) => {
  const userId = req.user.id;

  try {
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    cart.items = [];
    await cart.save();

    res.status(200).json({ message: "Cart cleared successfully", cart });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ message: "Failed to clear cart", error: error.message });
  }
};

const addToCart = async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const userId = req.user.id;

  try {
    // Find product by product_id instead of _id
    const product = await Product.findOne({ product_id: productId });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      // Check stock before creating new cart
      if (quantity > product.stock_quantity) {
        return res.status(400).json({ 
          message: "Insufficient stock", 
          availableStock: product.stock_quantity 
        });
      }
      cart = new Cart({ userId, items: [{ productId, quantity }] });
    } else {
      const itemIndex = cart.items.findIndex(item => item.productId === productId);
      if (itemIndex > -1) {
        const newQuantity = cart.items[itemIndex].quantity + quantity;
        // Check stock before updating
        if (newQuantity > product.stock_quantity) {
          return res.status(400).json({ 
            message: "Insufficient stock", 
            availableStock: product.stock_quantity,
            currentInCart: cart.items[itemIndex].quantity
          });
        }
        cart.items[itemIndex].quantity = newQuantity;
      } else {
        // Check stock before adding new item
        if (quantity > product.stock_quantity) {
          return res.status(400).json({ 
            message: "Insufficient stock", 
            availableStock: product.stock_quantity 
          });
        }
        cart.items.push({ productId, quantity });
      }
    }

    await cart.save();
    res.status(200).json({ message: "Item added to cart successfully", cart });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ message: "Failed to add item to cart", error: error.message });
  }
};

const removeFromWishlist = async (req, res) => {
  const { productId } = req.params;
  const userId = req.user.id;

  try {
    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      return res.status(404).json({ message: "Wishlist not found" });
    }

    wishlist.products = wishlist.products.filter(id => id !== productId);
    await wishlist.save();

    res.status(200).json({ message: "Item removed from wishlist successfully", wishlist });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    res.status(500).json({ message: "Failed to remove from wishlist", error: error.message });
  }
};


module.exports = {
  getAllProductsForUser,
  addToCart, 
  addToWishlist, 
  getCartItems, 
  getWishlistItems,
  updateCartItemQuantity,
  removeFromCart,
  clearCart,
  removeFromWishlist
};



