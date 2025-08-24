// const express = require("express");
// const dotenv = require("dotenv").config();
// const dbConnect = require("./config/dbConnect");
// const authRoutes = require("./routes/authRoutes");
// const userRoutes = require("./routes/userRoutes");
// const adminRoutes = require("./routes/adminRoutes");
// const customerRoutes = require("./routes/customerRoutes")
// const cors = require("cors");
// const paymentController = require("./controllers/paymentController");


// dbConnect();

// const app = express()

// app.use(cors({
//   origin: process.env.FRONTEND_URL,
//   credentials: true,
// }));


// // Webhook route MUST be before express.json() middleware to receive raw body
// app.use('/api/customer/payment-webhook', 
//   express.raw({ type: 'application/json' }), 
//   paymentController.handleWebhook
// );

// //middleware
// app.use(express.json());

// //routes
// app.use("/api/auth", authRoutes);
// app.use("/api/users", userRoutes);
// app.use("/api/admin", adminRoutes);
// app.use("/api/customer", customerRoutes); 

// //start the server
// const PORT = process.env.PORT || 7002;
// app.listen(PORT, ()=>{
//     console.log(`server in running on ${PORT}`);
// })


const express = require("express");
const dotenv = require("dotenv").config();
const dbConnect = require("./config/dbConnect");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const customerRoutes = require("./routes/customerRoutes")
const cors = require("cors");
const paymentController = require("./controllers/paymentController");

dbConnect();

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

// IMPORTANT: Webhook route MUST be before express.json() middleware 
// This webhook endpoint will be configured in your Stripe dashboard
app.use('/webhook/stripe', 
  express.raw({ type: 'application/json' }), 
  paymentController.handleWebhook
);

// KEEP this old endpoint for backward compatibility during testing
app.use('/api/customer/payment-webhook', 
  express.raw({ type: 'application/json' }), 
  paymentController.handleWebhook
);

// Middleware - MUST come after webhook routes
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/customer", customerRoutes); 

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: error.message })
  });
});

// Start the server
// const PORT = process.env.PORT || 7002;
// app.listen(PORT, () => {
//     console.log(`🚀 Server running on port ${PORT}`);
//     console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
//     console.log(`🔗 CORS enabled for: ${process.env.FRONTEND_URL}`);
//     console.log(`💳 Webhook endpoints:`);
//     console.log(`   - /webhook/stripe (production)`);
//     console.log(`   - /api/customer/payment-webhook (testing)`);
// });

// #for production
// Start the server
const PORT = process.env.PORT || 7001;  // production port
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 CORS enabled for: ${process.env.FRONTEND_URL}`);
});