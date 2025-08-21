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


// Webhook route MUST be before express.json() middleware to receive raw body
app.use('/api/customer/payment-webhook', 
  express.raw({ type: 'application/json' }), 
  paymentController.handleWebhook
);

//middleware
app.use(express.json());

//routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/customer", customerRoutes); 

//start the server
const PORT = process.env.PORT || 7002;
app.listen(PORT, ()=>{
    console.log(`server in running on ${PORT}`);
})