const nodemailer = require("nodemailer");
 
// Create transporter with better error handling
const createTransporter = () => {
  console.log("=== EMAIL TRANSPORTER DEBUG ===");
  console.log("EMAIL_USER:", process.env.EMAIL_USER ? "Set" : "Not set");
  console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "Set" : "Not set");
 
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("EMAIL_USER and EMAIL_PASS environment variables are required");
  }
 
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    secure: false,
    tls: {
      rejectUnauthorized: false
    }
  });
};
 
// Email verification template
const getVerificationEmailTemplate = (username, verificationUrl) => {
  return {
    subject: "Verify Your Email - The Cologne Hub",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Email Verification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: bold; color: #8B4513; margin-bottom: 10px; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 10px; margin: 20px 0; }
          .button {
            display: inline-block;
            background: #8B4513;
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: bold;
          }
          .button:hover { background: #6B3410; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">The Cologne Hub</div>
            <p>Welcome to your fragrance journey</p>
          </div>
         
          <div class="content">
            <h2>Welcome to The Cologne Hub, ${username}!</h2>
            <p>Thank you for joining our fragrance community. To complete your registration and start exploring our collection, please verify your email address by clicking the button below:</p>
           
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button" target="_blank" rel="noopener">Verify My Email</a>
            </div>
           
            <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px;">
              ${verificationUrl}
            </p>
           
            <div class="warning">
              <strong>Security Note:</strong> This verification link will expire in 24 hours. If you didn't create this account, please ignore this email.
            </div>
            
            <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0;">
              <strong>What happens after verification:</strong>
              <ul style="margin: 10px 0 0 20px; padding: 0;">
                <li>You'll be automatically logged into your account</li>
                <li>You'll receive a welcome message</li>
                <li>You can immediately start using The Cologne Hub</li>
              </ul>
            </div>
          </div>
         
          <div class="footer">
            <p>© 2025 The Cologne Hub. All rights reserved.</p>
            <p>This email was sent to verify your account registration.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Welcome to The Cologne Hub, ${username}!
     
      Thank you for joining our fragrance community. To complete your registration, please verify your email address by visiting this link:
     
      ${verificationUrl}
     
      After clicking the link, you'll be automatically logged in and can start using your account immediately.
     
      This link will expire in 24 hours. If you didn't create this account, please ignore this email.
     
      © 2025 The Cologne Hub
    `
  };
};
 
// Send verification email with FRONTEND URL (not backend API)
// Add this debug section to your sendVerificationEmail function

const sendVerificationEmail = async (email, username, token) => {
  try {
    console.log("=== ENVIRONMENT DEBUG ===");
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("FRONTEND_URL from env:", process.env.FRONTEND_URL);
    console.log("All environment variables:", Object.keys(process.env).filter(key => 
      key.includes('NODE_ENV') || key.includes('FRONTEND') || key.includes('BACKEND')
    ).reduce((obj, key) => {
      obj[key] = process.env[key];
      return obj;
    }, {}));

    // FIXED: More explicit URL determination
    let frontendUrl;
    
    if (process.env.NODE_ENV === 'production') {
      frontendUrl = process.env.FRONTEND_URL || 'https://thecolognehub.netlify.app';
      console.log("Using production URL:", frontendUrl);
    } else {
      frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
      console.log("Using development URL:", frontendUrl);
    }
    
    console.log("Final frontend URL:", frontendUrl);
    
    // Rest of your existing code...
    const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;
    console.log("Final verification URL:", verificationUrl);
    
    // Continue with email sending...
  } catch (error) {
    // Error handling
  }
};
 
// Send welcome email after verification
const sendWelcomeEmail = async (email, username) => {
  try {
    const transporter = createTransporter();
   
    // Test connection first
    await transporter.verify();
   
    const result = await transporter.sendMail({
      from: `"The Cologne Hub" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Welcome to The Cologne Hub! 🌟",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { font-size: 28px; font-weight: bold; color: #8B4513; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 10px; }
            .success { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">The Cologne Hub</div>
            </div>
           
            <div class="content">
              <div class="success">
                <h2>🎉 Email Verified Successfully!</h2>
              </div>
             
              <p>Hi ${username},</p>
              <p>Congratulations! Your email has been successfully verified. You now have full access to The Cologne Hub and can:</p>
             
              <ul>
                <li>Browse our extensive fragrance collection</li>
                <li>Save fragrances to your wishlist</li>
                <li>Place orders and track deliveries</li>
                <li>Receive exclusive offers and updates</li>
              </ul>
             
              <p>Thank you for joining our fragrance community. Happy exploring!</p>
             
              <p>Best regards,<br>The Cologne Hub Team</p>
            </div>
          </div>
        </body>
        </html>
      `
    });
   
    console.log("Welcome email sent successfully:", result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return { success: false, error: error.message };
  }
};
 
module.exports = {
  sendVerificationEmail,
  sendWelcomeEmail
};