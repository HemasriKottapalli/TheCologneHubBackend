const nodemailer = require("nodemailer");
 
// Create transporter with better error handling
const createTransporter = () => {
  console.log("=== EMAIL TRANSPORTER DEBUG ===");
  console.log("EMAIL_USER:", process.env.EMAIL_USER ? "Set" : "Not set");
  console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "Set" : "Not set");
 
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("EMAIL_USER and EMAIL_PASS environment variables are required");
  }
 
  // CORRECT METHOD NAME: createTransport (not createTransporter)
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS // This should be your app password, not regular password
    },
    // Add these additional settings for better reliability
    secure: false, // Use STARTTLS
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
              <a href="${verificationUrl}" class="button">Verify My Email</a>
            </div>
           
            <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px;">
              ${verificationUrl}
            </p>
           
            <div class="warning">
              <strong>Security Note:</strong> This verification link will expire in 24 hours. If you didn't create this account, please ignore this email.
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
     
      This link will expire in 24 hours. If you didn't create this account, please ignore this email.
     
      © 2025 The Cologne Hub
    `
  };
};
 
// Send verification email with better error handling
const sendVerificationEmail = async (email, username, token) => {
  try {
    console.log("=== SENDING EMAIL DEBUG ===");
    console.log("To:", email);
    console.log("Username:", username);
    console.log("Token:", token ? "Present" : "Missing");
    console.log("FRONTEND_URL:", process.env.FRONTEND_URL || 'http://localhost:3000');
   
    if (!token) {
      throw new Error("Verification token is missing");
    }
   
    const transporter = createTransporter();
   
    // Test the transporter connection first
    await transporter.verify();
    console.log("SMTP connection verified successfully");
   
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
    console.log("Verification URL:", verificationUrl);
   
    const emailTemplate = getVerificationEmailTemplate(username, verificationUrl);
   
    const mailOptions = {
      from: `"The Cologne Hub" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text
    };
   
    console.log("Mail options:", {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject
    });
   
    const result = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", result.messageId);
    console.log("Response:", result.response);
    console.log(`Verification email sent to ${email}`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('=== EMAIL ERROR DEBUG ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error command:', error.command);
    console.error('Error stack:', error.stack);
   
    // Provide more specific error messages
    let errorMessage = 'Failed to send verification email';
   
    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed. Please check your email credentials.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Could not connect to email server. Please try again later.';
    } else if (error.code === 'EMESSAGE') {
      errorMessage = 'Email message format error.';
    } else if (error.message.includes('Invalid login')) {
      errorMessage = 'Invalid email credentials. Please check your app password.';
    }
   
    throw new Error(errorMessage + ' Details: ' + error.message);
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
    // Don't throw error for welcome email failure
    return { success: false, error: error.message };
  }
};
 
module.exports = {
  sendVerificationEmail,
  sendWelcomeEmail
};
 