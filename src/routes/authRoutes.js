const express = require("express");
const {
  register,
  login,
  loginVerified,
  verifyEmail,
  resendVerificationEmail,
  getVerificationStatus,
  forgotPassword,
  resetPassword
} = require("../controllers/authController");
 
const router = express.Router();

// Security middleware for verification endpoint
const verificationSecurityMiddleware = (req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
};

// Basic routes (no rate limiting)
router.post('/register', register);
router.post('/login', login);
router.post('/login-verified', loginVerified);

// Email verification routes with security and rate limiting
router.get('/verify-email/:token', verificationSecurityMiddleware, verifyEmail);

// Routes with rate limiting (middleware is applied in the controller)
router.post('/resend-verification', resendVerificationEmail);
router.get('/verification-status/:email', getVerificationStatus);

router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

module.exports = router;