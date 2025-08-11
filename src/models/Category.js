const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  category_id: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  count: {
    type: String, // Store as string (e.g., '120+')
    required: true
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

module.exports = mongoose.model('Category', categorySchema);