const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { sendVerificationEmail, sendWelcomeEmail } = require("../utils/emailService");

const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({
        message: "Username, email, and password are required",
        success: false
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "Please provide a valid email address",
        success: false
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
        success: false
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "Email already exists",
        success: false
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role: "user",
      isEmailVerified: false,
    });

    const verificationToken = newUser.generateEmailVerificationToken();
    await newUser.save();

    try {
      await sendVerificationEmail(email, username, verificationToken);
      res.status(201).json({
        message: "Registration successful! Please check your email to verify your account.",
        emailSent: true,
        email: email,
        success: true
      });
    } catch (emailError) {
      res.status(201).json({
        message: "Account created successfully, but there was an issue sending the verification email. Please try resending it.",
        emailSent: false,
        email: email,
        success: true
      });
    }
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        message: "Validation error: " + Object.values(err.errors).map(e => e.message).join(', '),
        success: false
      });
    }
    
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(400).json({
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
        success: false
      });
    }

    res.status(500).json({
      message: "Something went wrong during registration",
      success: false
    });
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await User.findOne({ 
      $or: [
        { username: username },
        { email: username }
      ]
    });
    
    if (!user) {
      return res.status(404).json({ message: "No user found with that username/email" });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    
    if (!user.isEmailVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in",
        emailVerificationRequired: true,
        email: user.email
      });
    }
    
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.status(200).json({
      token,
      role: user.role,
      username: user.username,
      email: user.email,
      isEmailVerified: user.isEmailVerified
    });
  } catch (err) {
    res.status(500).json({ message: 'Something went wrong during login' });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.redirect(`${process.env.FRONTEND_URL}/?status=error&message=${encodeURIComponent("Verification token is required")}`);
    }

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      const expiredUser = await User.findOne({ emailVerificationToken: token });
      if (expiredUser) {
        return res.redirect(`${process.env.FRONTEND_URL}/?status=expired&message=${encodeURIComponent("Verification link has expired. Please request a new one.")}`);
      }
      return res.redirect(`${process.env.FRONTEND_URL}/?status=invalid&message=${encodeURIComponent("Invalid or already used verification token")}`);
    }

    user.verifyEmail();
    await user.save();

    const jwtToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    try {
      await sendWelcomeEmail(user.email, user.username);
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
    }

    // Store user data in localStorage and trigger login
    const userData = encodeURIComponent(JSON.stringify({
      token: jwtToken,
      role: user.role,
      username: user.username,
      email: user.email,
      isEmailVerified: true
    }));

    return res.redirect(`${process.env.FRONTEND_URL}/?status=success&data=${userData}&message=${encodeURIComponent("Email verified successfully! You are now logged in.")}`);
  } catch (err) {
    return res.redirect(`${process.env.FRONTEND_URL}/?status=error&message=${encodeURIComponent("Something went wrong during email verification")}`);
  }
};

const resendVerificationEmail = async (req, res) => {
  try {
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
    
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();
    
    try {
      await sendVerificationEmail(email, user.username, verificationToken);
      res.status(200).json({
        message: "Verification email sent successfully! Please check your inbox.",
        emailSent: true,
        success: true
      });
    } catch (emailError) {
      res.status(500).json({
        message: "Failed to send verification email: " + emailError.message,
        emailSent: false,
        success: false
      });
    }
  } catch (err) {
    res.status(500).json({
      message: 'Something went wrong while resending verification email',
      success: false
    });
  }
};

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