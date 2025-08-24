const mongoose = require("mongoose");
const crypto = require("crypto");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user"
  },
  
  // Email Verification Fields
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    default: null
  },
  emailVerificationExpires: {
    type: Date,
    default: null
  },
  
  // Password Reset Fields
  passwordResetToken: {
    type: String,
    default: null
  },
  passwordResetExpires: {
    type: Date,
    default: null
  },
  
  // User Profile Fields
  profile: {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    phone: { type: String, trim: true },
    dateOfBirth: { type: Date },
    gender: { 
      type: String, 
      enum: ["male", "female", "other", "prefer-not-to-say"] 
    },
    preferences: {
      newsletter: { type: Boolean, default: true },
      smsNotifications: { type: Boolean, default: false },
      favoriteFragranceTypes: [{ type: String }]
    }
  },
  
  // Address Information
  addresses: [{
    type: {
      type: String,
      enum: ["shipping", "billing", "both"],
      default: "both"
    },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    company: String,
    address1: { type: String, required: true },
    address2: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true, default: "US" },
    phone: String,
    isDefault: { type: Boolean, default: false }
  }],
  
  // Account Status
  accountStatus: {
    type: String,
    enum: ["active", "suspended", "deactivated"],
    default: "active"
  },
  
  // Tracking Fields
  lastLogin: { type: Date },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ emailVerificationToken: 1 });
userSchema.index({ passwordResetToken: 1 });

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Email Verification Methods
userSchema.methods.generateEmailVerificationToken = function() {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = verificationToken; // Store raw token
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return verificationToken; // Return raw token for email
};

userSchema.methods.verifyEmail = function() {
  this.isEmailVerified = true;
  this.emailVerificationToken = null;
  this.emailVerificationExpires = null;
};

// Password Reset Methods
userSchema.methods.generatePasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  return resetToken; // Return raw token for email
};

userSchema.methods.clearPasswordReset = function() {
  this.passwordResetToken = null;
  this.passwordResetExpires = null;
};

// Account Security Methods
userSchema.methods.incrementLoginAttempts = function() {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 };
  }
  
  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Static method to find user by reset token
userSchema.statics.findByPasswordResetToken = function(token) {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  return this.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });
};

// Static method to find user by verification token
userSchema.statics.findByVerificationToken = function(token) {
  return this.findOne({
    emailVerificationToken: token, // Use raw token
    emailVerificationExpires: { $gt: Date.now() }
  });
};

// Middleware to update lastLogin
userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  this.resetLoginAttempts();
  return this.save();
};

// Clean up expired tokens periodically
userSchema.statics.cleanupExpiredTokens = function() {
  const now = Date.now();
  return this.updateMany(
    {
      $or: [
        { emailVerificationExpires: { $lt: now } },
        { passwordResetExpires: { $lt: now } }
      ]
    },
    {
      $unset: {
        emailVerificationToken: 1,
        emailVerificationExpires: 1,
        passwordResetToken: 1,
        passwordResetExpires: 1
      }
    }
  );
};

// Pre-save middleware to handle email changes
userSchema.pre('save', function(next) {
  if (this.isModified('email') && !this.isNew) {
    this.isEmailVerified = false;
    this.emailVerificationToken = null;
    this.emailVerificationExpires = null;
  }
  next();
});

// Ensure JSON output includes virtuals
userSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.password;
    delete ret.emailVerificationToken;
    delete ret.passwordResetToken;
    delete ret.loginAttempts;
    delete ret.lockUntil;
    return ret;
  }
});

module.exports = mongoose.model("User", userSchema);