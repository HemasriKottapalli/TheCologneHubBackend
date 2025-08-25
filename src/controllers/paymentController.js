const Stripe = require('stripe');
const mongoose = require('mongoose');
const Order = require('../models/Order');
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

      if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.addressLine1) {
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

      // Ensure total is valid (minimum 50 cents for Stripe USD)
      const calculatedTotal = Math.max(total, 0.50);

      // Create payment intent with USD currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(calculatedTotal * 100), // Convert to cents
        currency: 'usd',
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          userId: userId,
          promoCode: promoCode || '',
          itemCount: items.length.toString()
        }
      });

      // Store order as pending
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
          email: shippingAddress.email,
          phone: shippingAddress.phone,
          addressLine1: shippingAddress.addressLine1,
          addressLine2: shippingAddress.addressLine2 || '',
          city: shippingAddress.city || '',
          state: shippingAddress.state || '',
          zipCode: shippingAddress.zipCode || '',
          country: shippingAddress.country || 'United States'
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

  // Confirm payment and complete order - WITH TRANSACTION TO PREVENT DOUBLE PROCESSING
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

      // Find order
      const order = await Order.findOne({ _id: orderId, userId });
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      // CRITICAL: Check if order is already processed to prevent double processing
      if (order.status === 'confirmed') {
        console.log('⚠️ Order already confirmed, skipping stock reduction');
        return res.json({
          success: true,
          message: 'Order already confirmed',
          order: {
            id: order._id,
            orderId: order.orderId,
            status: order.status,
            total: order.total,
            items: order.items,
            shippingAddress: order.shippingAddress
          }
        });
      }

      // Use MongoDB transaction to ensure atomicity
      const session = await mongoose.startSession();
      
      try {
        const result = await session.withTransaction(async () => {
          // Double-check order status within transaction
          const currentOrder = await Order.findById(orderId).session(session);
          if (currentOrder.status === 'confirmed') {
            throw new Error('ORDER_ALREADY_CONFIRMED');
          }

          // Update product stock with stock validation
          for (const item of order.items) {
            const product = await Product.findOneAndUpdate(
              { 
                product_id: item.productId,
                stock_quantity: { $gte: item.quantity } // Ensure stock is still available
              },
              { $inc: { stock_quantity: -item.quantity } },
              { session, new: true }
            );
            
            if (!product) {
              throw new Error(`Insufficient stock for ${item.productName}. Please refresh and try again.`);
            }
            
            console.log(`✅ Stock reduced for ${item.productName}: ${product.stock_quantity + item.quantity} → ${product.stock_quantity}`);
          }

          // Update order status
          const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            {
              status: 'confirmed',
              paymentStatus: 'paid',
              paymentId: paymentIntentId,
              confirmedAt: new Date()
            },
            { session, new: true }
          );

          // Clear user's cart
          await Cart.findOneAndUpdate(
            { userId },
            { $set: { items: [] } },
            { session }
          );

          return updatedOrder;
        });

        console.log('✅ Payment confirmed and stock reduced successfully');

        res.json({
          success: true,
          order: {
            id: result._id,
            orderId: result.orderId,
            status: result.status,
            total: result.total,
            items: result.items,
            shippingAddress: result.shippingAddress
          }
        });

      } catch (transactionError) {
        // Handle specific transaction errors
        if (transactionError.message === 'ORDER_ALREADY_CONFIRMED') {
          // Order was confirmed by another process (like webhook)
          const confirmedOrder = await Order.findById(orderId);
          return res.json({
            success: true,
            message: 'Order confirmed by another process',
            order: {
              id: confirmedOrder._id,
              orderId: confirmedOrder.orderId,
              status: confirmedOrder.status,
              total: confirmedOrder.total,
              items: confirmedOrder.items,
              shippingAddress: confirmedOrder.shippingAddress
            }
          });
        }
        
        throw transactionError;
      } finally {
        await session.endSession();
      }

    } catch (error) {
      console.error('❌ Payment confirmation error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to confirm payment'
      });
    }
  },

  // Handle Stripe webhooks - ONLY PROCESS IF API CONFIRMATION DIDN'T RUN
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
        console.log('🔔 Webhook: Payment succeeded for', paymentIntent.id);
        
        // Only process if order is still pending (API confirmation didn't run)
        const order = await Order.findOne({ paymentId: paymentIntent.id });
        if (order && order.status === 'pending') {
          console.log('📦 Webhook: Processing payment confirmation (API didn\'t run)');
          await handleSuccessfulPaymentWebhook(paymentIntent);
        } else if (order) {
          console.log('✅ Webhook: Order already processed by API, skipping');
        } else {
          console.log('⚠️ Webhook: No order found for payment intent');
        }
        break;
      
      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        console.log('❌ Webhook: Payment failed for', failedPayment.id);
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

// WEBHOOK-ONLY processing function (when API confirmation doesn't run)
async function handleSuccessfulPaymentWebhook(paymentIntent) {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ paymentId: paymentIntent.id }).session(session);
      
      if (order && order.status === 'pending') {
        console.log('🔄 Webhook: Processing stock reduction');
        
        // Update product stock
        for (const item of order.items) {
          const product = await Product.findOneAndUpdate(
            { 
              product_id: item.productId,
              stock_quantity: { $gte: item.quantity }
            },
            { $inc: { stock_quantity: -item.quantity } },
            { session, new: true }
          );
          
          if (!product) {
            throw new Error(`Insufficient stock for ${item.productName}`);
          }
          
          console.log(`✅ Webhook: Stock reduced for ${item.productName}`);
        }

        // Update order
        order.status = 'confirmed';
        order.paymentStatus = 'paid';
        order.confirmedAt = new Date();
        await order.save({ session });

        // Clear cart
        await Cart.findOneAndUpdate(
          { userId: order.userId },
          { $set: { items: [] } },
          { session }
        );
        
        console.log('✅ Webhook: Order confirmed successfully');
      } else if (order) {
        console.log('ℹ️ Webhook: Order already processed, no action needed');
      }
    });
  } catch (error) {
    console.error('❌ Error in webhook payment handling:', error);
  } finally {
    await session.endSession();
  }
}

// Handle failed payments
async function handleFailedPayment(paymentIntent) {
  try {
    const order = await Order.findOne({ paymentId: paymentIntent.id });
    if (order && order.status !== 'cancelled') {
      order.status = 'cancelled';
      order.paymentStatus = 'failed';
      await order.save();
      console.log('❌ Order cancelled due to payment failure');
    }
  } catch (error) {
    console.error('Error handling failed payment:', error);
  }
}

module.exports = paymentController;