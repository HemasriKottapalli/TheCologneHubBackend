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
    res.status(500).json({ message: 'Something went wrong during verified login' });
  }
};

// NEW: Updated verifyEmail function that shows success page and broadcasts to other tabs
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Verification Error</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .error { color: #e74c3c; }
            .icon { font-size: 48px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">❌</div>
            <h2 class="error">Verification Failed</h2>
            <p>Verification token is required</p>
          </div>
        </body>
        </html>
      `);
    }

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      const expiredUser = await User.findOne({ emailVerificationToken: token });
      if (expiredUser) {
        return res.status(400).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Link Expired</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
              .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .error { color: #e74c3c; }
              .icon { font-size: 48px; margin-bottom: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="icon">⏰</div>
              <h2 class="error">Link Expired</h2>
              <p>Verification link has expired. Please request a new one.</p>
            </div>
          </body>
          </html>
        `);
      }
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invalid Link</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .error { color: #e74c3c; }
            .icon { font-size: 48px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">❌</div>
            <h2 class="error">Invalid Link</h2>
            <p>Invalid or already used verification token</p>
          </div>
        </body>
        </html>
      `);
    }

    // Verify the user
    user.verifyEmail();
    await user.save();

    // Generate JWT token
    const jwtToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Send welcome email
    try {
      await sendWelcomeEmail(user.email, user.username);
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
    }

    // Return success page with cross-tab communication
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Email Verified Successfully</title>
        <meta charset="utf-8">
        <style>
          body { 
            font-family: 'Arial', sans-serif; 
            text-align: center; 
            padding: 30px; 
            background: linear-gradient(135deg, #8B4513 0%, #A0522D 100%);
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container { 
            max-width: 500px; 
            margin: 0 auto; 
            background: white; 
            padding: 50px 40px; 
            border-radius: 20px; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            position: relative;
          }
          .success { color: #27ae60; }
          .icon { 
            font-size: 64px; 
            margin-bottom: 20px; 
            animation: bounce 2s infinite;
          }
          .logo {
            font-size: 28px;
            font-weight: bold;
            color: #8B4513;
            margin-bottom: 10px;
          }
          .message {
            font-size: 18px;
            margin: 20px 0;
            color: #2c3e50;
            line-height: 1.6;
          }
          .submessage {
            font-size: 14px;
            color: #7f8c8d;
            margin-top: 30px;
          }
          @keyframes bounce {
            0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-10px); }
            60% { transform: translateY(-5px); }
          }
          .checkmark {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            display: block;
            stroke-width: 2;
            stroke: #27ae60;
            stroke-miterlimit: 10;
            margin: 20px auto;
            box-shadow: inset 0px 0px 0px #27ae60;
            animation: fill .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s both;
          }
          .checkmark__circle {
            stroke-dasharray: 166;
            stroke-dashoffset: 166;
            stroke-width: 2;
            stroke-miterlimit: 10;
            stroke: #27ae60;
            fill: none;
            animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
          }
          .checkmark__check {
            transform-origin: 50% 50%;
            stroke-dasharray: 48;
            stroke-dashoffset: 48;
            animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
          }
          @keyframes stroke {
            100% { stroke-dashoffset: 0; }
          }
          @keyframes scale {
            0%, 100% { transform: none; }
            50% { transform: scale3d(1.1, 1.1, 1); }
          }
          @keyframes fill {
            100% { box-shadow: inset 0px 0px 0px 30px #27ae60; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">The Cologne Hub</div>
          
          <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
            <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
            <path class="checkmark__check" fill="none" d="m14.1 27.2l7.1 7.2 16.7-16.8"/>
          </svg>
          
          <h2 class="success">Email Verified Successfully!</h2>
          <div class="message">
            Welcome to The Cologne Hub, <strong>${user.username}</strong>!<br>
            Your email has been verified and you are now logged in.
          </div>
          <div class="submessage">
            You can now close this tab and continue using The Cologne Hub.
          </div>
        </div>

        <script>
          // Broadcast verification success to all other tabs/windows
          const userData = {
            token: "${jwtToken}",
            role: "${user.role}",
            username: "${user.username}",
            email: "${user.email}",
            isEmailVerified: true
          };

          // Use BroadcastChannel for same-origin communication
          if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('email_verification');
            channel.postMessage({
              type: 'EMAIL_VERIFIED',
              data: userData
            });
            
            // Close the channel after a brief delay
            setTimeout(() => {
              channel.close();
            }, 1000);
          }

          // Fallback: Use localStorage events for older browsers
          localStorage.setItem('emailVerificationData', JSON.stringify({
            timestamp: Date.now(),
            data: userData
          }));
          
          // Clean up after 5 seconds
          setTimeout(() => {
            localStorage.removeItem('emailVerificationData');
          }, 5000);

          // Also try postMessage to parent window if opened in popup
          if (window.opener) {
            window.opener.postMessage({
              type: 'EMAIL_VERIFIED',
              data: userData
            }, '*');
          }

          // Auto-close after 3 seconds if opened in popup
          setTimeout(() => {
            if (window.opener) {
              window.close();
            }
          }, 3000);
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Email verification error:', err);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Verification Error</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
          .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .error { color: #e74c3c; }
          .icon { font-size: 48px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">❌</div>
          <h2 class="error">Verification Failed</h2>
          <p>Something went wrong during email verification</p>
        </div>
      </body>
      </html>
    `);
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
  loginVerified,
  verifyEmail,
  resendVerificationEmail,
  getVerificationStatus
};