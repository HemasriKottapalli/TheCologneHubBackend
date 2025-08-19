const nodemailer = require('nodemailer');

let transporter = null;

// Create and cache transporter
const createTransporter = () => {
  if (transporter) {
    return transporter;
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('EMAIL_USER and EMAIL_PASS environment variables are required');
  }

  const config = {
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  };

  // Use secure connection for production
  if (process.env.NODE_ENV === 'production') {
    config.secure = true;
    config.port = 465;
  } else {
    config.secure = false;
    config.tls = { rejectUnauthorized: false };
  }

  transporter = nodemailer.createTransport(config);

  // Verify connection on creation
  transporter.verify((error) => {
    if (error) {
      console.error('SMTP verification failed:', error);
      throw new Error('Email server connection failed: ' + error.message);
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log('SMTP connection verified successfully');
    }
  });

  return transporter;
};

// Email verification template
const getVerificationEmailTemplate = (username, verificationUrl) => {
  const frontendUrl = process.env.FRONTEND_URL || 'https://thecolognehub.netlify.app';
  return {
    subject: 'Verify Your Email - The Cologne Hub',
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
              <strong>Security Note:</strong> This verification link will expire in 24 hours. If you didn't create this account, please ignore this email. After verification, you'll be automatically logged in to your account.
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
     
      After clicking the link, you'll be automatically logged in to your account.
     
      This link will expire in 24 hours. If you didn't create this account, please ignore this email.
     
      © 2025 The Cologne Hub
    `
  };
};

// Success email template for verification
const getVerificationSuccessTemplate = (username) => {
  return {
    subject: 'Email Verification Successful - The Cologne Hub',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Email Verification Success</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: bold; color: #8B4513; margin-bottom: 10px; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 10px; margin: 20px 0; }
          .success { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">The Cologne Hub</div>
            <p>Your fragrance journey begins</p>
          </div>
         
          <div class="content">
            <div class="success">
              <h2>🎉 Email Verified Successfully!</h2>
            </div>
            <p>Hi ${username},</p>
            <p>Congratulations! Your email has been successfully verified. You are now logged in to The Cologne Hub in your original browser tab.</p>
            <p>You can now:</p>
            <ul style="margin: 10px 0 0 20px; padding: 0;">
              <li>Browse our extensive fragrance collection</li>
              <li>Save fragrances to your wishlist</li>
              <li>Place orders and track deliveries</li>
              <li>Receive exclusive offers and updates</li>
            </ul>
            <p>You can close this window and return to your original tab to continue your fragrance journey.</p>
            <p>Best regards,<br>The Cologne Hub Team</p>
          </div>
         
          <div class="footer">
            <p>© 2025 The Cologne Hub. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Email Verification Successful!
      
      Hi ${username},
      
      Congratulations! Your email has been successfully verified. You are now logged in to The Cologne Hub in your original browser tab.
      
      You can now:
      - Browse our extensive fragrance collection
      - Save fragrances to your wishlist
      - Place orders and track deliveries
      - Receive exclusive offers and updates
      
      You can close this window and return to your original tab to continue your fragrance journey.
      
      Best regards,
      The Cologne Hub Team
      
      © 2025 The Cologne Hub
    `
  };
};

// Send verification email
const sendVerificationEmail = async (email, username, token) => {
  try {
    if (!token) {
      throw new Error('Verification token is missing');
    }

    const backendUrl = (process.env.NODE_ENV === 'production'
      ? process.env.BACKEND_URL || 'https://thecolognehubbackend.onrender.com'
      : process.env.BACKEND_URL || 'http://localhost:7001').replace(/\/$/, '');

    const verificationUrl = `${backendUrl}/api/auth/verify-email/${token}`;
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('=== SENDING EMAIL DEBUG ===');
      console.log('To:', email);
      console.log('Username:', username);
      console.log('Token:', token ? 'Present' : 'Missing');
      console.log('NODE_ENV:', process.env.NODE_ENV);
      console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
      console.log('BACKEND_URL:', backendUrl);
      console.log('Verification URL:', verificationUrl);
    }

    const transporter = createTransporter();
    const emailTemplate = getVerificationEmailTemplate(username, verificationUrl);

    const mailOptions = {
      from: `"The Cologne Hub" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text
    };

    const result = await transporter.sendMail(mailOptions);
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('Email sent successfully:', result.messageId);
      console.log('Response:', result.response);
    }
    
    console.log(`Verification email sent to ${email}`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('=== EMAIL ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error command:', error.command);
    
    let errorMessage = 'Failed to send verification email';
    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed. Please check your email credentials.';
    } else if (error.code === 'ECONNECTION' || error.code === 'ENOTFOUND') {
      errorMessage = 'Could not connect to email server. Please try again later.';
    } else if (error.code === 'EMESSAGE') {
      errorMessage = 'Email message format error.';
    } else if (error.message?.includes('Invalid login')) {
      errorMessage = 'Invalid email credentials. Please check your app password.';
    } else if (error.message?.includes('Username and Password not accepted')) {
      errorMessage = 'Gmail authentication failed. Make sure you are using an App Password.';
    }

    throw new Error(errorMessage + (process.env.NODE_ENV === 'development' ? ' Details: ' + error.message : ''));
  }
};

// Send welcome email after verification
const sendWelcomeEmail = async (email, username) => {
  try {
    const transporter = createTransporter();
    const emailTemplate = getVerificationSuccessTemplate(username);

    const mailOptions = {
      from: `"The Cologne Hub" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text
    };

    const result = await transporter.sendMail(mailOptions);
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('Welcome email sent successfully:', result.messageId);
    }
    
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw new Error('Failed to send welcome email: ' + error.message);
  }
};

module.exports = {
  sendVerificationEmail,
  sendWelcomeEmail
};