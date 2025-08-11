const mongoose = require('mongoose');
 
const brandSchema = new mongoose.Schema({
  brandName: {
    type: String,
    required: true,
  },
  popularBrand: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });
 
module.exports = mongoose.model('Brand', brandSchema);