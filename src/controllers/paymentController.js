const Stripe = require('stripe');
const Order = require('../models/Order')
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const paymentController = {
  // Create payment intent for Stripe
  createPaymentIntent: async (req, res) => {
    try {
      const userId = req.user.id;
      const { items, promoCode, subtotal, promoDiscount, shipping, tax, total, shippingAddress } = req.body;

      // Validate required fields
      if (!items || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No items in cart'
        });
      }

      if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.address) {
        return res.status(400).json({
          success: false,
          message: 'Complete shipping address is required'
        });
      }

      // Validate cart items and stock
      const cartValidation = await validateCartItems(items, userId);
      if (!cartValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: cartValidation.message
        });
      }

      // Ensure total is valid (minimum 1 rupee for Stripe India)
      const calculatedTotal = Math.max(total, 1.0);

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(calculatedTotal * 100), // Convert to paise
        currency: 'inr',
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          userId: userId,
          promoCode: promoCode || '',
          itemCount: items.length.toString()
        }
      });

      // Store order as pending with your existing schema structure
      const order = new Order({
        userId,
        items: items.map(item => ({
          productId: item.productId,
          productName: item.name,
          quantity: item.quantity,
          price: item.price,
          totalPrice: item.price * item.quantity
        })),
        subtotal: subtotal || 0,
        promoDiscount: promoDiscount || 0,
        promoCode: promoCode || null,
        shipping: shipping || 0,
        tax: tax || 0,
        total: calculatedTotal,
        status: 'pending',
        paymentMethod: 'card',
        paymentStatus: 'pending',
        paymentId: paymentIntent.id,
        shippingAddress: {
          fullName: shippingAddress.fullName,
          address: shippingAddress.address,
          city: shippingAddress.city || '',
          state: shippingAddress.state || '',
          zipCode: shippingAddress.zipCode || '',
          country: shippingAddress.country || 'India'
        }
      });

      await order.save();

      res.json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        orderId: order._id,
        orderNumber: order.orderId
      });

    } catch (error) {
      console.error('Payment intent creation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create payment intent'
      });
    }
  },

  // Confirm payment and complete order
  confirmPayment: async (req, res) => {
    try {
      const { paymentIntentId, orderId } = req.body;
      const userId = req.user.id;

      if (!paymentIntentId || !orderId) {
        return res.status(400).json({
          success: false,
          message: 'Payment intent ID and order ID are required'
        });
      }

      // Retrieve payment intent from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({
          success: false,
          message: 'Payment not completed'
        });
      }

      // Find and update order
      const order = await Order.findOne({ _id: orderId, userId });
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      // Check if order is already processed to prevent double processing
      if (order.status === 'confirmed') {
        return res.json({
          success: true,
          message: 'Order already confirmed',
          order: {
            id: order._id,
            orderId: order.orderId,
            status: order.status,
            total: order.total,
            items: order.items,
            estimatedDelivery: order.estimatedDelivery
          }
        });
      }

      // Update product stock using product_id
      for (const item of order.items) {
        const product = await Product.findOne({ product_id: item.productId });
        if (product) {
          if (product.stock_quantity < item.quantity) {
            return res.status(400).json({
              success: false,
              message: `Insufficient stock for ${product.name}`
            });
          }
          
          await Product.findOneAndUpdate(
            { product_id: item.productId },
            { $inc: { stock_quantity: -item.quantity } }
          );
        }
      }

      // Update order status
      order.status = 'confirmed';
      order.paymentStatus = 'paid';
      order.paymentId = paymentIntentId;
      await order.save();

      // Clear user's cart
      await Cart.findOneAndUpdate(
        { userId },
        { $set: { items: [] } }
      );

      res.json({
        success: true,
        order: {
          id: order._id,
          orderId: order.orderId,
          status: order.status,
          total: order.total,
          items: order.items,
          estimatedDelivery: order.estimatedDelivery
        }
      });

    } catch (error) {
      console.error('Payment confirmation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to confirm payment'
      });
    }
  },

  // Handle Stripe webhooks
  handleWebhook: async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        await handleSuccessfulPayment(paymentIntent);
        break;
      
      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        await handleFailedPayment(failedPayment);
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  },

  // Get order details
  getOrder: async (req, res) => {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;

      const order = await Order.findOne({ _id: orderId, userId });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      res.json({
        success: true,
        order
      });

    } catch (error) {
      console.error('Get order error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve order'
      });
    }
  }
};

// Helper functions
async function validateCartItems(items, userId) {
  try {
    // Get user's current cart
    const cart = await Cart.findOne({ userId });
    
    if (!cart || cart.items.length === 0) {
      return { isValid: false, message: 'Cart is empty' };
    }

    // Validate each item using product_id
    for (const item of items) {
      const product = await Product.findOne({ product_id: item.productId });
      
      if (!product) {
        return { isValid: false, message: `Product ${item.productId} not found` };
      }

      if (product.stock_quantity < item.quantity) {
        return { 
          isValid: false, 
          message: `Insufficient stock for ${product.name}. Only ${product.stock_quantity} available` 
        };
      }

      // Validate price to prevent tampering
      if (Math.abs(product.retail_price - item.price) > 0.01) {
        return {
          isValid: false,
          message: `Price mismatch for ${product.name}`
        };
      }
    }

    return { isValid: true };
  } catch (error) {
    return { isValid: false, message: 'Failed to validate cart items' };
  }
}

async function handleSuccessfulPayment(paymentIntent) {
  try {
    const order = await Order.findOne({ paymentId: paymentIntent.id });
    if (order && order.status !== 'confirmed') {
      order.status = 'confirmed';
      order.paymentStatus = 'paid';
      await order.save();

      // Update product stock using product_id
      for (const item of order.items) {
        await Product.findOneAndUpdate(
          { product_id: item.productId },
          { $inc: { stock_quantity: -item.quantity } }
        );
      }
    }
  } catch (error) {
    console.error('Error handling successful payment:', error);
  }
}

async function handleFailedPayment(paymentIntent) {
  try {
    const order = await Order.findOne({ paymentId: paymentIntent.id });
    if (order) {
      order.status = 'cancelled';
      order.paymentStatus = 'failed';
      await order.save();
    }
  } catch (error) {
    console.error('Error handling failed payment:', error);
  }
}

module.exports = paymentController;