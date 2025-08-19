const express = require("express");
const {
  register,
  login,
  loginVerified,  // ADD THIS - needed for auto-login after verification
  verifyEmail,
  resendVerificationEmail,
  getVerificationStatus
} = require("../controllers/authController");
 
const router = express.Router();
 
// Existing routes
router.post('/register', register);
router.post('/login', login);
router.post('/login-verified', loginVerified);  // ADD THIS - for auto-login after verification
 
// Email verification routes
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);
router.get('/verification-status/:email', getVerificationStatus);

module.exports = router;