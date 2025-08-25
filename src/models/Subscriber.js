const mongoose = require("mongoose");

const subscriberSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});

const Subscriber = mongoose.model("Subscriber", subscriberSchema);

module.exports = Subscriber;