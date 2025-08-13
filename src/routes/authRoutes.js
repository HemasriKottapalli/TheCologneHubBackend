const express = require("express");
const {
  register,
  login,
  verifyEmail,
  resendVerificationEmail,
  getVerificationStatus
} = require("../controllers/authController");
 
const router = express.Router();
 
// Existing routes
router.post('/register', register);
router.post('/login', login);
 
// New email verification routes
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);
router.get('/verification-status/:email', getVerificationStatus);
 
module.exports = router;
 