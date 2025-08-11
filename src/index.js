const express = require("express");
const dotenv = require("dotenv").config();
const dbConnect = require("./config/dbConnect");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const customerRoutes = require("./routes/customerRoutes")
 
const cors = require("cors");


dbConnect();

const app = express()

// Allow requests from React app (localhost:5173)
app.use(cors({
  origin: "https://thecolognehub.netlify.app",
  credentials: true,
}));

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