const Subscriber = require("../models/Subscriber");
const XLSX = require("xlsx");
const nodemailer = require("nodemailer");

// Configure Nodemailer
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Add Subscriber
const addSubscriber = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if already subscribed
    const existing = await Subscriber.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: "Email already subscribed" });
    }

    const subscriber = new Subscriber({ email });
    await subscriber.save();

    // Send Mail
    const unsubscribeLink = `${process.env.BackendForEmail}/api/subscribers/unsubscribe/page/${subscriber._id}`;
    await transporter.sendMail({
      from: `"The Cologne Hub" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Welcome to The Cologne Hub!",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Subscription Confirmation</title>
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
              <div class="greeting">Thank You for Subscribing!</div>
              <div class="message">
                You're now part of The Cologne Hub community. Get ready to explore our exclusive fragrance collection and receive special offers!
              </div>
              <div class="button-container">
                <a href="${unsubscribeLink}" class="button">Unsubscribe</a>
              </div>
              <div style="margin-top: 24px; padding: 16px; background: #f8f9fa; border-radius: 6px; font-size: 13px; color: #666;">
                You can unsubscribe at any time using the link above.
              </div>
            </div>
            <div class="footer">
              <div>© 2025 The Cologne Hub. All rights reserved.</div>
              <div class="footer-note">
                If you did not subscribe, please ignore this email.
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Thank you for subscribing to The Cologne Hub!

        You're now part of our community. Get ready to explore our exclusive fragrance collection and receive special offers!

        To unsubscribe, visit this link: ${unsubscribeLink}

        If you did not subscribe, please ignore this email.

        © 2025 The Cologne Hub
      `,
    });

    res.status(201).json({ message: "Subscribed successfully", subscriber });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Remove (Unsubscribe)
const removeSubscriber = async (req, res) => {
  try {
    const { id } = req.params;
    const subscriber = await Subscriber.findByIdAndDelete(id);
    if (!subscriber) return res.status(404).json({ error: "Subscriber not found" });

    res.json({ message: "Unsubscribed successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Unsubscribe Subscriber
const unsubscribeSubscriber = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Unsubscribe Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              background: #f8f9fa;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }
            .container { 
              max-width: 600px; 
              margin: 40px; 
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
            .content { 
              padding: 40px; 
              text-align: center;
            }
            .error { 
              font-size: 20px;
              font-weight: 600;
              color: #e74c3c;
              margin-bottom: 16px;
            }
            .message {
              font-size: 16px;
              color: #666;
              margin-bottom: 30px;
              line-height: 1.5;
            }
            .footer { 
              background: #f8f9fa;
              padding: 20px 40px; 
              text-align: center; 
              font-size: 12px; 
              color: #999; 
              border-top: 1px solid #eee;
            }
            @media (max-width: 600px) {
              .container { margin: 20px; }
              .header, .content, .footer { padding: 20px; }
              .logo { font-size: 24px; }
              .error { font-size: 18px; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">The Cologne Hub</div>
            </div>
            <div class="content">
              <div class="error">Unsubscribe Failed</div>
              <div class="message">
                The unsubscribe token is missing. Please check the link or contact support.
              </div>
            </div>
            <div class="footer">
              <div>© 2025 The Cologne Hub. All rights reserved.</div>
            </div>
          </div>
        </body>
        </html>
      `);
    }

    // Find subscriber by token
    const subscriber = await Subscriber.findById(token);

    if (!subscriber) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Invalid Unsubscribe Link</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              background: #f8f9fa;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }
            .container { 
              max-width: 600px; 
              margin: 40px; 
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
            .content { 
              padding: 40px; 
              text-align: center;
            }
            .error { 
              font-size: 20px;
              font-weight: 600;
              color: #e74c3c;
              margin-bottom: 16px;
            }
            .message {
              font-size: 16px;
              color: #666;
              margin-bottom: 30px;
              line-height: 1.5;
            }
            .footer { 
              background: #f8f9fa;
              padding: 20px 40px; 
              text-align: center; 
              font-size: 12px; 
              color: #999; 
              border-top: 1px solid #eee;
            }
            @media (max-width: 600px) {
              .container { margin: 20px; }
              .header, .content, .footer { padding: 20px; }
              .logo { font-size: 24px; }
              .error { font-size: 18px; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">The Cologne Hub</div>
            </div>
            <div class="content">
              <div class="error">Invalid Unsubscribe Link</div>
              <div class="message">
                The unsubscribe link is invalid or the subscription has already been removed.
              </div>
            </div>
            <div class="footer">
              <div>© 2025 The Cologne Hub. All rights reserved.</div>
            </div>
          </div>
        </body>
        </html>
      `);
    }

    // Delete subscriber from DB
    await Subscriber.findByIdAndDelete(token);

    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Unsubscribed Successfully</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background: #f8f9fa;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }
          .container { 
            max-width: 600px; 
            margin: 40px; 
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
          .content { 
            padding: 40px; 
            text-align: center;
          }
          .success { 
            font-size: 20px;
            font-weight: 600;
            color: #27ae60;
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
            .success { font-size: 18px; }
            .button { padding: 14px 28px; font-size: 15px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">The Cologne Hub</div>
          </div>
          <div class="content">
            <div class="success">You Have Been Unsubscribed</div>
            <div class="message">
              We're sorry to see you go. Your email has been successfully removed from our mailing list.
            </div>
            <div style="margin: 30px 0;">
              <a href="${process.env.BackendForEmail}" class="button">Return to The Cologne Hub</a>
            </div>
            <div style="margin-top: 24px; padding: 16px; background: #f8f9fa; border-radius: 6px; font-size: 13px; color: #666;">
              If this was a mistake, you can re-subscribe anytime.
            </div>
          </div>
          <div class="footer">
            <div>© 2025 The Cologne Hub. All rights reserved.</div>
            <div class="footer-note">
              Need help? Contact our support team.
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("Unsubscribe error:", err);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Unsubscribe Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background: #f8f9fa;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }
          .container { 
            max-width: 600px; 
            margin: 40px; 
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
          .content { 
            padding: 40px; 
            text-align: center;
          }
          .error { 
            font-size: 20px;
            font-weight: 600;
            color: #e74c3c;
            margin-bottom: 16px;
          }
          .message {
            font-size: 16px;
            color: #666;
            margin-bottom: 30px;
            line-height: 1.5;
          }
          .footer { 
            background: #f8f9fa;
            padding: 20px 40px; 
            text-align: center; 
            font-size: 12px; 
            color: #999; 
            border-top: 1px solid #eee;
          }
          @media (max-width: 600px) {
            .container { margin: 20px; }
            .header, .content, .footer { padding: 20px; }
            .logo { font-size: 24px; }
            .error { font-size: 18px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">The Cologne Hub</div>
          </div>
          <div class="content">
            <div class="error">Unsubscribe Failed</div>
            <div class="message">
              Something went wrong while processing your request. Please try again or contact support.
            </div>
          </div>
          <div class="footer">
            <div>© 2025 The Cologne Hub. All rights reserved.</div>
          </div>
        </body>
        </html>
      `);
  }
};

// Export XLSX
const exportSubscribers = async (req, res) => {
  try {
    const subscribers = await Subscriber.find().lean();
    const worksheet = XLSX.utils.json_to_sheet(subscribers);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Subscribers");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", "attachment; filename=subscribers.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.end(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Export Subscribers Data
const exportSubscribersData = async (req, res) => {
  try {
    const subscribers = await Subscriber.find();
    res.json(subscribers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  addSubscriber,
  removeSubscriber,
  exportSubscribers,
  exportSubscribersData,
  unsubscribeSubscriber
};