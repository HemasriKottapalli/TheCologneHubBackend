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
    host: 'smtp.gmail.com',
    port: process.env.NODE_ENV === 'production' ? 465 : 587,
    secure: process.env.NODE_ENV === 'production', // Use SSL in production
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  };

  if (process.env.NODE_ENV !== 'production') {
    config.tls = { rejectUnauthorized: false };
  }

  transporter = nodemailer.createTransport(config);

  // Verify connection on creation
  transporter.verify((error) => {
    if (error) {
      console.error('SMTP verification failed:', error);
      throw new Error('Email server connection failed: ' + error.message);
    }
    console.log('SMTP connection verified successfully');
  });

  return transporter;
};

// Minimal email verification template with your brand colors
const getVerificationEmailTemplate = (username, verificationUrl) => {
  return {
    subject: 'Verify Your Email - The Cologne Hub',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verify Your Email</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background: #f8f9fa;
          }
          .container { 
            max-width: 600px; 
            margin: 40px auto; 
            background: white; 
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(139, 90, 124, 0.1);
          }
          .header { 
            background: linear-gradient(135deg, #8B5A7C 0%, #A66A94 100%); 
            padding: 30px 40px; 
            text-align: center; 
            color: white;
          }
          .logo { 
            font-size: 28px; 
            font-weight: bold; 
            margin-bottom: 8px;
            font-family: 'Caveat', cursive;
          }
          .tagline { 
            font-size: 14px; 
            opacity: 0.9; 
          }
          .content { 
            padding: 40px; 
            text-align: center;
          }
          .greeting {
            font-size: 20px;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 16px;
          }
          .message {
            font-size: 16px;
            color: #666;
            margin-bottom: 30px;
            line-height: 1.5;
          }
          .button-container {
            margin: 30px 0;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #8B5A7C 0%, #A66A94 100%);
            color: white;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 4px 12px rgba(139, 90, 124, 0.3);
            transition: transform 0.2s ease;
          }
          .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(139, 90, 124, 0.4);
          }
          .footer { 
            background: #f8f9fa;
            padding: 20px 40px; 
            text-align: center; 
            font-size: 12px; 
            color: #999; 
            border-top: 1px solid #eee;
          }
          .footer-note {
            margin-top: 12px;
            font-size: 11px;
            color: #bbb;
          }
          @media (max-width: 600px) {
            .container { margin: 20px; }
            .header, .content, .footer { padding: 20px; }
            .logo { font-size: 24px; }
            .greeting { font-size: 18px; }
            .button { padding: 14px 28px; font-size: 15px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">The Cologne Hub</div>
            <div class="tagline">Your fragrance journey awaits</div>
          </div>
         
          <div class="content">
            <div class="greeting">Welcome, ${username}!</div>
            <div class="message">
              Click the button below to verify your email and start exploring our fragrance collection.
            </div>
           
            <div class="button-container">
              <a href="${verificationUrl}" class="button">Verify My Email</a>
            </div>
            
            <div style="margin-top: 24px; padding: 16px; background: #f8f9fa; border-radius: 6px; font-size: 13px; color: #666;">
              This link expires in 24 hours for security
            </div>
          </div>
         
          <div class="footer">
            <div>© 2025 The Cologne Hub. All rights reserved.</div>
            <div class="footer-note">
              If you didn't create this account, please ignore this email.
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Welcome to The Cologne Hub, ${username}!
     
      Please verify your email address by visiting this link:
      ${verificationUrl}
     
      This link will expire in 24 hours.
     
      If you didn't create this account, please ignore this email.
     
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

    // Use BackendForEmail for user-facing links, with fallback
    const baseUrl = process.env.BackendForEmail || 'http://localhost:3000';
    const BackendForEmail = baseUrl.replace(/\/$/, '');

    const verificationUrl = `${BackendForEmail}/api/auth/verify-email/${token}`;
    
    // Debug logging
    console.log('=== EMAIL VERIFICATION URL DEBUG ===');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('BackendForEmail:', process.env.BackendForEmail);
    console.log('Verification URL:', verificationUrl);
    console.log('=====================================');

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
    
    console.log('Email sent successfully:', result.messageId);
    console.log('Response:', result.response);
    console.log(`Verification email sent to ${email} with URL: ${verificationUrl}`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('=== EMAIL VERIFICATION ERROR ===');
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

// Send password reset email
const sendPasswordResetEmail = async (email, username, token) => {
  try {
    if (!token) {
      throw new Error('Reset token is missing');
    }

    // Use BackendForEmail for user-facing links, with fallback
    const baseUrl = process.env.BackendForEmail || 'http://localhost:3000';
    const BackendForEmail = baseUrl.replace(/\/$/, '');

    const resetUrl = `${BackendForEmail}/reset-password?token=${token}`;
    
    console.log('=== PASSWORD RESET EMAIL DEBUG ===');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('BackendForEmail:', process.env.BackendForEmail);
    console.log('Reset URL:', resetUrl);
    console.log('=====================================');

    const transporter = createTransporter();
    const emailTemplate = getPasswordResetEmailTemplate(username, resetUrl);

    const mailOptions = {
      from: `"The Cologne Hub" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text
    };

    const result = await transporter.sendMail(mailOptions);
    
    console.log('Password reset email sent successfully:', result.messageId);
    console.log('Response:', result.response);
    console.log(`Password reset email sent to ${email} with URL: ${resetUrl}`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('=== PASSWORD RESET EMAIL ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error command:', error.command);
    
    let errorMessage = 'Failed to send password reset email';
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

const getPasswordResetEmailTemplate = (username, resetUrl) => {
  return {
    subject: 'Reset Your Password - The Cologne Hub',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reset Your Password</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background: #f8f9fa;
          }
          .container { 
            max-width: 600px; 
            margin: 40px auto; 
            background: white; 
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(139, 90, 124, 0.1);
          }
          .header { 
            background: linear-gradient(135deg, #8B5A7C 0%, #A66A94 100%); 
            padding: 30px 40px; 
            text-align: center; 
            color: white;
          }
          .logo { 
            font-size: 28px; 
            font-weight: bold; 
            margin-bottom: 8px;
          }
          .content { 
            padding: 40px; 
            text-align: center;
          }
          .greeting {
            font-size: 20px;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 16px;
          }
          .message {
            font-size: 16px;
            color: #666;
            margin-bottom: 30px;
            line-height: 1.5;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #8B5A7C 0%, #A66A94 100%);
            color: white;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 4px 12px rgba(139, 90, 124, 0.3);
          }
          .footer { 
            background: #f8f9fa;
            padding: 20px 40px; 
            text-align: center; 
            font-size: 12px; 
            color: #999; 
            border-top: 1px solid #eee;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">The Cologne Hub</div>
            <div>Password Reset Request</div>
          </div>
         
          <div class="content">
            <div class="greeting">Hi ${username},</div>
            <div class="message">
              We received a request to reset your password. Click the button below to create a new password.
            </div>
           
            <div style="margin: 30px 0;">
              <a href="${resetUrl}" class="button">Reset My Password</a>
            </div>
            
            <div style="margin-top: 24px; padding: 16px; background: #f8f9fa; border-radius: 6px; font-size: 13px; color: #666;">
              This link expires in 1 hour. If you didn't request this, ignore this email.
            </div>
          </div>
         
          <div class="footer">
            <div>© 2025 The Cologne Hub. All rights reserved.</div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hi ${username},
     
      We received a request to reset your password for The Cologne Hub.
     
      Please visit this link to reset your password:
      ${resetUrl}
     
      This link will expire in 1 hour.
     
      If you didn't request this password reset, please ignore this email.
     
      © 2025 The Cologne Hub
    `
  };
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail
};