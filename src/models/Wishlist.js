// models/Wishlist.js
const mongoose = require("mongoose");

const wishlistSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  products: [
    {
      type: String, // Changed from ObjectId to String
      ref: "Product"
    }
  ],
}, { timestamps: true });

module.exports = mongoose.model("Wishlist", wishlistSchema);