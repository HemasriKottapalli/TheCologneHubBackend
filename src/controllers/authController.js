const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../utils/emailService");
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

// Rate limiting for resend verification emails
const resendLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // 3 resends per 5 minutes per IP
  message: {
    message: "Too many verification emails sent. Please wait 5 minutes before requesting another.",
    success: false
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development'
});

// Rate limiting for verification status checks
const statusCheckLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 checks per minute per IP
  message: {
    message: "Too many status checks. Please slow down.",
    success: false
  },
  skip: (req) => process.env.NODE_ENV === 'development'
});

// Rate limiting for forgot password
const forgotPasswordLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 attempts per 5 minutes per IP
  message: {
    message: "Too many password reset attempts. Please wait 5 minutes before trying again.",
    success: false
  },
  skip: (req) => process.env.NODE_ENV === 'development'
});

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
      console.error('Registration email error:', emailError);
      res.status(201).json({
        message: "Account created successfully, but there was an issue sending the verification email. Please try resending it.",
        emailSent: false,
        email: email,
        success: true
      });
    }
  } catch (err) {
    console.error('Registration error:', err);
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
    
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

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
    console.error('Login error:', err);
    res.status(500).json({ message: 'Something went wrong during login' });
  }
};

const loginVerified = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ message: "No user found with that email" });
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
    console.error('Verified login error:', err);
    res.status(500).json({ message: 'Something went wrong during verified login' });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    
    // Security headers
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    if (!token) {
      return res.status(400).json({ message: 'Verification token is required', success: false });
    }

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      const expiredUser = await User.findOne({ emailVerificationToken: token });
      if (expiredUser) {
        return res.status(400).json({ message: 'Verification link has expired. Please request a new one.', success: false });
      }
      return res.status(400).json({ message: 'Invalid or already used verification token', success: false });
    }

    // Verify the user and update DB
    user.verifyEmail();
    await user.save();

    console.log(`Email verified for user: ${user.email}`);

    // Return JSON response for frontend handling
    return res.status(200).json({
      message: 'Email verified successfully!',
      success: true,
      username: user.username
    });
    
  } catch (err) {
    console.error('Email verification error:', err);
    return res.status(500).json({ message: 'Something went wrong during email verification', success: false });
  }
};

const resendVerificationEmail = async (req, res) => {
  try {
    console.log('=== RESEND EMAIL DEBUG START ===');
    console.log('Request body:', req.body);
    console.log('NODE_ENV:', process.env.NODE_ENV);
    
    const { email } = req.body;
    
    if (!email) {
      console.log('ERROR: No email provided');
      return res.status(400).json({
        message: "Email is required",
        success: false
      });
    }
    
    console.log('Looking for user with email:', email);
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('ERROR: User not found');
      return res.status(404).json({
        message: "No user found with that email address",
        success: false
      });
    }
    
    console.log('User found:', user.username, 'Verified:', user.isEmailVerified);
    
    if (user.isEmailVerified) {
      console.log('ERROR: Email already verified');
      return res.status(400).json({
        message: "Email is already verified",
        success: false
      });
    }

    // Less restrictive check for recent attempts
    const recentAttempts = await User.countDocuments({
      email: email,
      emailVerificationExpires: { $gt: Date.now() - (5 * 60 * 1000) }
    });
    
    console.log('Recent attempts:', recentAttempts);
    
    if (recentAttempts > 10) {
      console.log('ERROR: Too many recent attempts');
      return res.status(429).json({
        message: "Too many verification attempts. Please wait 5 minutes before trying again.",
        success: false
      });
    }
    
    console.log('Generating new verification token...');
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();
    console.log('Token generated and saved');
    
    try {
      console.log('Attempting to send email...');
      await sendVerificationEmail(email, user.username, verificationToken);
      console.log('Email sent successfully!');
      
      res.status(200).json({
        message: "Verification email sent successfully!",
        emailSent: true,
        success: true
      });
    } catch (emailError) {
      console.error('EMAIL SENDING ERROR:', emailError);
      console.error('Error type:', typeof emailError);
      console.error('Error properties:', Object.keys(emailError));
      
      let errorMessage = "Failed to send verification email";
      
      if (emailError.message) {
        if (emailError.message.includes('createTransport')) {
          errorMessage = "Email service configuration error. Please contact support.";
        } else if (emailError.message.includes('EAUTH')) {
          errorMessage = "Email authentication failed. Please try again later.";
        } else if (emailError.message.includes('ECONNECTION')) {
          errorMessage = "Could not connect to email server. Please try again.";
        } else {
          errorMessage = emailError.message;
        }
      }
      
      res.status(500).json({
        message: errorMessage,
        emailSent: false,
        success: false,
        debug: process.env.NODE_ENV === 'development' ? {
          error: emailError.message,
          stack: emailError.stack
        } : undefined
      });
    }
    
    console.log('=== RESEND EMAIL DEBUG END ===');
  } catch (err) {
    console.error('=== RESEND EMAIL CONTROLLER ERROR ===');
    console.error('Error:', err);
    console.error('Stack:', err.stack);
    
    res.status(500).json({
      message: 'Something went wrong while resending verification email',
      success: false,
      debug: process.env.NODE_ENV === 'development' ? {
        error: err.message,
        stack: err.stack
      } : undefined
    });
  }
};

const getVerificationStatus = async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({ 
        message: "Email is required",
        isEmailVerified: false
      });
    }

    const user = await User.findOne({ email }).select('isEmailVerified username');
    
    if (!user) {
      return res.status(404).json({ 
        message: "User not found",
        isEmailVerified: false
      });
    }
    
    res.status(200).json({
      isEmailVerified: user.isEmailVerified,
      username: user.username,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Verification status check error:', err);
    res.status(500).json({ 
      message: 'Something went wrong',
      isEmailVerified: false
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    console.log('=== FORGOT PASSWORD DEBUG START ===');
    console.log('Request body:', req.body);
    console.log('NODE_ENV:', process.env.NODE_ENV);
    
    const { email } = req.body;
    
    if (!email) {
      console.log('ERROR: No email provided');
      return res.status(400).json({
        message: "Email is required",
        success: false
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('ERROR: Invalid email format');
      return res.status(400).json({
        message: "Please provide a valid email address",
        success: false
      });
    }

    console.log('Looking for user with email:', email);
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (!user) {
      console.log('ERROR: User not found');
      return res.status(404).json({
        message: "No account found with this email address",
        success: false
      });
    }

    console.log('User found:', user.username);

    // Check for recent reset attempts
    if (user.passwordResetExpires && user.passwordResetExpires > Date.now()) {
      const timeLeft = Math.ceil((user.passwordResetExpires - Date.now()) / (1000 * 60));
      console.log('ERROR: Recent reset attempt found, time left:', timeLeft);
      return res.status(429).json({
        message: `Password reset already requested. Please wait ${timeLeft} minutes before requesting again.`,
        success: false
      });
    }

    // Generate reset token
    console.log('Generating reset token...');
    const resetToken = user.generatePasswordResetToken();
    await user.save();
    console.log('Reset token generated and saved');

    try {
      console.log('Attempting to send password reset email...');
      await sendPasswordResetEmail(user.email, user.username, resetToken);
      console.log('Password reset email sent successfully');
      
      res.status(200).json({
        message: "Password reset link sent to your email",
        emailSent: true,
        success: true
      });
    } catch (emailError) {
      console.error('PASSWORD RESET EMAIL ERROR:', emailError);
      console.error('Error type:', typeof emailError);
      console.error('Error properties:', Object.keys(emailError));
      
      // Clear the reset token if email failed
      user.clearPasswordReset();
      await user.save();
      
      let errorMessage = "Failed to send password reset email";
      if (emailError.message) {
        if (emailError.message.includes('createTransport')) {
          errorMessage = "Email service configuration error. Please contact support.";
        } else if (emailError.message.includes('EAUTH')) {
          errorMessage = "Email authentication failed. Please try again later.";
        } else if (emailError.message.includes('ECONNECTION')) {
          errorMessage = "Could not connect to email server. Please try again.";
        } else if (emailError.message.includes('Invalid login') || emailError.message.includes('Username and Password not accepted')) {
          errorMessage = "Invalid email credentials. Please check your email settings.";
        } else {
          errorMessage = emailError.message;
        }
      }
      
      res.status(500).json({
        message: errorMessage,
        emailSent: false,
        success: false,
        debug: process.env.NODE_ENV === 'development' ? {
          error: emailError.message,
          stack: emailError.stack
        } : undefined
      });
    }
    
    console.log('=== FORGOT PASSWORD DEBUG END ===');
  } catch (err) {
    console.error('=== FORGOT PASSWORD CONTROLLER ERROR ===');
    console.error('Error:', err);
    console.error('Stack:', err.stack);
    
    res.status(500).json({
      message: 'Something went wrong while processing your request',
      success: false,
      debug: process.env.NODE_ENV === 'development' ? {
        error: err.message,
        stack: err.stack
      } : undefined
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    
    // Security headers
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    if (!token) {
      return res.status(400).json({ message: 'Reset token is required', success: false });
    }

    if (!password) {
      return res.status(400).json({ message: 'New password is required', success: false });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long', success: false });
    }

    // Hash token and find user
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset link', success: false });
    }

    // Update password and clear reset fields
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.clearPasswordReset();
    await user.save();

    console.log(`Password reset successful for user: ${user.email}`);

    // Return JSON response
    return res.status(200).json({
      message: 'Password reset successful! You can now log in with your new password.',
      success: true,
      username: user.username
    });
    
  } catch (err) {
    console.error('Password reset error:', err);
    return res.status(500).json({ message: 'Something went wrong while resetting your password', success: false });
  }
};

module.exports = {
  register,
  login,
  loginVerified,
  verifyEmail,
  resendVerificationEmail: [resendLimit, resendVerificationEmail],
  getVerificationStatus: [statusCheckLimit, getVerificationStatus],
  forgotPassword: [forgotPasswordLimit, forgotPassword],
  resetPassword
};