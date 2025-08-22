// models/Order.js - Updated with confirmedAt field
const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true }, // Price at time of order
  totalPrice: { type: Number, required: true } // quantity * price
});

const orderSchema = new mongoose.Schema({
  orderId: { 
    type: String, 
    required: true, 
    unique: true,
    default: function() {
      return 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    }
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  items: [orderItemSchema],
  
  // Pricing breakdown
  subtotal: { type: Number, required: true },
  promoDiscount: { type: Number, default: 0 },
  promoCode: { type: String, default: null },
  shipping: { type: Number, required: true },
  tax: { type: Number, required: true },
  total: { type: Number, required: true },
  
  // Order status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  
  // Shipping information
  shippingAddress: {
    fullName: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true, default: 'United States' } // Changed to US
  },
  
  // Payment information
  paymentMethod: {
    type: String,
    enum: ['card', 'cod', 'upi', 'netbanking'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentId: { type: String }, // For storing payment gateway transaction ID
  
  // Timestamps
  orderDate: { type: Date, default: Date.now },
  confirmedAt: { type: Date }, // NEW FIELD - tracks when order was confirmed and stock reduced
  estimatedDelivery: { type: Date },
  deliveredAt: { type: Date },
  
  // Additional fields
  notes: { type: String },
  trackingNumber: { type: String }
  
}, { 
  timestamps: true 
});

// Pre-save middleware to calculate estimated delivery (7 days from order)
orderSchema.pre('save', function(next) {
  if (this.isNew) {
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 7);
    this.estimatedDelivery = deliveryDate;
  }
  next();
});

// Method to update order status
orderSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  if (newStatus === 'delivered') {
    this.deliveredAt = new Date();
  }
  return this.save();
};

// Index for better performance
orderSchema.index({ paymentId: 1 });
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });

module.exports = mongoose.model("Order", orderSchema);