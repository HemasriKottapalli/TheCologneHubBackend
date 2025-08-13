const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { sendVerificationEmail,sendWelcomeEmail } = require("../utils/emailService");
 
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role: "user",
    });

    await newUser.save();
    res.status(201).json({ message: `User registered with email ${email}` });
  } catch (err) {
    res.status(500).json({ message: "something went wrong" });
  }
};
 
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(404)
        .json({ message: `No user found with that email` });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: `Invalid credentials` });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      token,
      role: user.role,
      username: user.username,
      email: user.email,
    });
  } catch (err) {
    res.status(500).json({ message: 'Something went wrong' });
  }
};

 
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
   
    console.log("=== EMAIL VERIFICATION DEBUG ===");
    console.log("Token received:", token);
 
    if (!token) {
      return res.status(400).json({
        message: "Verification token is required",
        expired: false
      });
    }
 
    // Find user with the verification token that hasn't expired
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });
 
    console.log("User found:", user ? "Yes" : "No");
   
    if (!user) {
      // Check if token exists but is expired
      const expiredUser = await User.findOne({
        emailVerificationToken: token
      });
     
      if (expiredUser) {
        console.log("Token found but expired");
        return res.status(400).json({
          message: "Verification token has expired. Please request a new one.",
          expired: true
        });
      } else {
        console.log("Token not found");
        return res.status(400).json({
          message: "Invalid verification token",
          expired: false
        });
      }
    }
 
    console.log("Verifying user:", user.username);
 
    // Verify the user's email
    user.verifyEmail();
    await user.save();
   
    console.log("User email verified successfully");
 
    // Send welcome email (optional, doesn't affect the verification process)
    try {
      const welcomeResult = await sendWelcomeEmail(user.email, user.username);
      console.log("Welcome email result:", welcomeResult);
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
      // Don't fail the verification if welcome email fails
    }
 
    res.status(200).json({
      message: "Email verified successfully! You can now log in.",
      verified: true,
      username: user.username,
      success: true
    });
  } catch (err) {
    console.error("Email verification error:", err);
    res.status(500).json({
      message: 'Something went wrong during email verification',
      success: false,
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
 
const resendVerificationEmail = async (req, res) => {
  try {
    console.log("=== RESEND EMAIL DEBUG ===");
    console.log("Request body:", req.body);
   
    const { email } = req.body;
 
    if (!email) {
      return res.status(400).json({
        message: "Email is required",
        success: false
      });
    }
 
    const user = await User.findOne({ email });
 
    if (!user) {
      return res.status(404).json({
        message: "No user found with that email address",
        success: false
      });
    }
 
    if (user.isEmailVerified) {
      return res.status(400).json({
        message: "Email is already verified",
        success: false
      });
    }
 
    console.log("User found, generating new token...");
 
    // Generate new verification token (overwrites the old one)
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();
   
    console.log("New token generated and saved");
 
    // Send verification email
    try {
      console.log("Attempting to resend verification email...");
      const emailResult = await sendVerificationEmail(email, user.username, verificationToken);
      console.log("Email result:", emailResult);
     
      if (emailResult && emailResult.success) {
        console.log("Verification email resent successfully");
       
        res.status(200).json({
          message: "Verification email sent successfully! Please check your inbox.",
          emailSent: true,
          success: true
        });
      } else {
        throw new Error("Email sending failed");
      }
    } catch (emailError) {
      console.error("Failed to resend verification email:", emailError);
      res.status(500).json({
        message: "Failed to send verification email: " + emailError.message,
        emailSent: false,
        success: false,
        error: emailError.message
      });
    }
  } catch (err) {
    console.error("Resend verification error:", err);
    res.status(500).json({
      message: 'Something went wrong while resending verification email',
      success: false,
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
 
// Helper function to get user verification status (for frontend use)
const getVerificationStatus = async (req, res) => {
  try {
    const { email } = req.params;
   
    const user = await User.findOne({ email }).select('isEmailVerified username');
   
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
 
    res.status(200).json({
      isEmailVerified: user.isEmailVerified,
      username: user.username
    });
  } catch (err) {
    console.error("Verification status error:", err);
    res.status(500).json({ message: 'Something went wrong' });
  }
};
 
module.exports = {
  register,
  login,
  verifyEmail,
  resendVerificationEmail,
  getVerificationStatus
};
 