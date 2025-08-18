const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { sendVerificationEmail, sendWelcomeEmail } = require("../utils/emailService");

// Updated registration controller with better error handling
const register = async (req, res) => {
  try {
    console.log("=== REGISTRATION DEBUG ===");
    console.log("Request body:", req.body);
    console.log("Request headers:", req.headers);
   
    const { username, email, password } = req.body;
 
    // Validate required fields
    if (!username || !email || !password) {
      console.log("Missing required fields:", { 
        username: !!username, 
        email: !!email, 
        password: !!password 
      });
      return res.status(400).json({
        message: "Username, email, and password are required",
        received: { username: !!username, email: !!email, password: !!password }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log("Invalid email format:", email);
      return res.status(400).json({
        message: "Please provide a valid email address"
      });
    }

    // Validate password length
    if (password.length < 6) {
      console.log("Password too short:", password.length);
      return res.status(400).json({
        message: "Password must be at least 6 characters long"
      });
    }
 
    console.log("All validations passed");
 
    // Check if email is already registered (email is unique identifier)
    console.log("Checking for existing email...");
    const existingUser = await User.findOne({ email });
   
    if (existingUser) {
      console.log("Existing user found:", {
        existingEmail: existingUser.email,
        existingUsername: existingUser.username
      });
      return res.status(400).json({
        message: "Email already exists"
      });
    }
 
    console.log("No existing user found, proceeding with registration");
 
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("Password hashed successfully");
 
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role: "user",
      isEmailVerified: false,
    });
 
    console.log("Creating new user object:", {
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      isEmailVerified: newUser.isEmailVerified
    });
 
    // Generate verification token BEFORE saving
    const verificationToken = newUser.generateEmailVerificationToken();
    console.log("Verification token generated:", verificationToken ? "Yes" : "No");
   
    // Save user to database
    await newUser.save();
    console.log("User saved to database successfully");
 
    // Send verification email
    try {
      console.log("Attempting to send verification email...");
      console.log("Environment check:", {
        EMAIL_USER: !!process.env.EMAIL_USER,
        EMAIL_PASS: !!process.env.EMAIL_PASS,
        FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000'
      });
      
      const emailResult = await sendVerificationEmail(email, username, verificationToken);
      console.log("Email result:", emailResult);
     
      if (emailResult && emailResult.success) {
        console.log("Verification email sent successfully");
       
        res.status(201).json({
          message: "Registration successful! Please check your email to verify your account.",
          emailSent: true,
          email: email,
          success: true
        });
      } else {
        throw new Error("Email sending failed");
      }
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError.message);
      console.error("Email error stack:", emailError.stack);
     
      // Still return success for registration, but indicate email issue
      res.status(201).json({
        message: "Account created successfully, but there was an issue sending the verification email. Please try resending it.",
        emailSent: false,
        email: email,
        success: true,
        emailError: emailError.message
      });
    }
  } catch (err) {
    console.error("=== REGISTRATION ERROR DEBUG ===");
    console.error("Error name:", err.name);
    console.error("Error message:", err.message);
    console.error("Error stack:", err.stack);
    console.error("Error code:", err.code);
   
    // Handle MongoDB validation errors specifically
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      console.error("Validation errors:", errors);
      return res.status(400).json({
        message: "Validation error: " + errors.join(', '),
        success: false,
        validationErrors: errors
      });
    }
   
    // Handle MongoDB duplicate key errors
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      console.error("Duplicate key error:", field, err.keyValue);
      return res.status(400).json({
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
        success: false,
        duplicateField: field
      });
    }

    // Handle MongoDB connection errors
    if (err.name === 'MongoNetworkError' || err.name === 'MongooseServerSelectionError') {
      console.error("Database connection error");
      return res.status(500).json({
        message: "Database connection failed. Please try again later.",
        success: false
      });
    }
   
    res.status(500).json({
      message: "Something went wrong during registration",
      success: false,
      error: process.env.NODE_ENV === 'development' ? {
        name: err.name,
        message: err.message,
        stack: err.stack
      } : undefined
    });
  }
};
 
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
 
    // Find user by email (unique identifier)
    const user = await User.findOne({ email });
 
    if (!user) {
      return res
        .status(404)
        .json({ message: "No user found with that email" });
    }
 
    const isMatch = await bcrypt.compare(password, user.password);
 
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
 
    // Check if email is verified
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
      { expiresIn: '1h' }
    );
 
    res.status(200).json({
      token,
      role: user.role,
      username: user.username,
      email: user.email,
      isEmailVerified: user.isEmailVerified
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: 'Something went wrong during login' });
  }
};

// FIXED: Email verification with proper HTML response for browser navigation
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
   
    console.log("=== EMAIL VERIFICATION DEBUG ===");
    console.log("Token received:", token);
 
    if (!token) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Verification Error</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .container { max-width: 500px; margin: 0 auto; }
            .error { color: #dc2626; }
            .btn { display: inline-block; padding: 10px 20px; background: #8B4513; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="error">Verification Error</h1>
            <p>Verification token is required</p>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" class="btn">Go to Home</a>
          </div>
        </body>
        </html>
      `);
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
        return res.status(400).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Verification Expired</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .container { max-width: 500px; margin: 0 auto; }
              .error { color: #dc2626; }
              .btn { display: inline-block; padding: 10px 20px; background: #8B4513; color: white; text-decoration: none; border-radius: 5px; margin: 10px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1 class="error">Verification Link Expired</h1>
              <p>This verification link has expired. Please request a new one.</p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}?showRegister=true" class="btn">Register Again</a>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" class="btn">Go to Home</a>
            </div>
          </body>
          </html>
        `);
      } else {
        console.log("Token not found");
        return res.status(400).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Invalid Token</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .container { max-width: 500px; margin: 0 auto; }
              .error { color: #dc2626; }
              .btn { display: inline-block; padding: 10px 20px; background: #8B4513; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1 class="error">Invalid Verification Token</h1>
              <p>This verification link is invalid or has already been used.</p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" class="btn">Go to Home</a>
            </div>
          </body>
          </html>
        `);
      }
    }
 
    console.log("Verifying user:", user.username);
 
    // Verify the user's email
    user.verifyEmail();
    await user.save();
   
    console.log("User email verified successfully");

    // Generate JWT token for auto-login
    const jwtToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' } // Extended expiry for better UX
    );
 
    // Send welcome email (optional, doesn't affect the verification process)
    try {
      const welcomeResult = await sendWelcomeEmail(user.email, user.username);
      console.log("Welcome email result:", welcomeResult);
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
      // Don't fail the verification if welcome email fails
    }

    // FIXED: Return HTML page that handles the verification and redirects
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Email Verified Successfully</title>
        <meta charset="utf-8">
        <style>
          body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
          }
          .success { color: #10b981; font-size: 60px; margin-bottom: 20px; }
          .checkmark {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: #10b981;
            margin: 0 auto 20px;
            position: relative;
            animation: checkmark 0.6s ease-in-out;
          }
          .checkmark::after {
            content: '✓';
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-size: 40px;
            font-weight: bold;
          }
          @keyframes checkmark {
            0% { transform: scale(0); }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); }
          }
          .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255,255,255,.3);
            border-radius: 50%;
            border-top-color: #fff;
            animation: spin 1s ease-in-out infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          h1 { margin-bottom: 20px; font-size: 2.5rem; }
          p { font-size: 1.2rem; margin-bottom: 15px; }
          .countdown { 
            font-size: 1.5rem; 
            font-weight: bold; 
            color: #fbbf24;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="checkmark"></div>
          <h1>Email Verified Successfully!</h1>
          <p>Welcome to The Cologne Hub, <strong>${user.username}</strong>!</p>
          <p>You are now logged in and have full access to your account.</p>
          <div class="loading"></div>
          <p class="countdown">Redirecting in <span id="countdown">3</span> seconds...</p>
        </div>

        <script>
          // Store login data
          const userData = {
            token: '${jwtToken}',
            role: '${user.role}',
            username: '${user.username}',
            email: '${user.email}',
            isEmailVerified: true
          };

          // Function to handle the login process
          function handleAutoLogin() {
            try {
              // Store in localStorage
              localStorage.setItem('token', userData.token);
              localStorage.setItem('role', userData.role);
              localStorage.setItem('username', userData.username);
              localStorage.setItem('email', userData.email);
              localStorage.setItem('isEmailVerified', 'true');
              
              // Trigger events for any listening components
              if (window.opener) {
                // If opened in popup/new tab, notify parent window
                window.opener.postMessage({
                  type: 'EMAIL_VERIFIED',
                  data: userData
                }, '${frontendUrl}');
              }
              
              // Set flag for verification success
              localStorage.setItem('justVerified', 'true');
              
              console.log('Email verification completed, user logged in');
            } catch (error) {
              console.error('Error storing login data:', error);
            }
          }

          // Auto-login immediately
          handleAutoLogin();

          // Countdown and redirect
          let countdown = 3;
          const countdownElement = document.getElementById('countdown');
          
          const timer = setInterval(() => {
            countdown--;
            countdownElement.textContent = countdown;
            
            if (countdown <= 0) {
              clearInterval(timer);
              
              // Redirect to home page with verification flag
              window.location.href = '${frontendUrl}/?verified=true';
            }
          }, 1000);

          // Allow immediate redirect on click
          document.body.addEventListener('click', () => {
            clearInterval(timer);
            window.location.href = '${frontendUrl}/?verified=true';
          });
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("Email verification error:", err);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Verification Error</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .container { max-width: 500px; margin: 0 auto; }
          .error { color: #dc2626; }
          .btn { display: inline-block; padding: 10px 20px; background: #8B4513; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 class="error">Verification Error</h1>
          <p>Something went wrong during email verification. Please try again.</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" class="btn">Go to Home</a>
        </div>
      </body>
      </html>
    `);
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