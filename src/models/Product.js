// models/Product.js
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  product_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  brand: String,
  category: String,
  tags: [String],
  rating: Number,
  cost_price: Number,
  retail_price: Number,
  stock_quantity: Number,
  image_url: String,
  description: String,
  created_at: {
    type: Date,
    default: Date.now
  }
});

// This tells Mongoose to use product_id as the reference field instead of _id
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model("Product", productSchema);