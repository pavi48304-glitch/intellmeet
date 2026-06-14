import express from 'express';
import nodemailer from 'nodemailer';
import { protect } from '../middleware/auth.js';
import { validate as validateEmail } from 'deep-email-validator';

const router = express.Router();

let testAccount = null;
let transporter = null;

// Initialize Nodemailer Transport
const initTransporter = async () => {
  if (!transporter) {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      // Use Production SMTP
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      console.log('📧 Nodemailer initialized with Production SMTP credentials');
    } else {
      // Use Ethereal Email for testing
      testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log('📧 Nodemailer initialized with Ethereal Test Account');
    }
  }
};

router.post('/', protect, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email address is required' });
    }

    // Validate email existence
    const { valid, reason, validators } = await validateEmail({
      email,
      validateRegex: true,
      validateMx: true,
      validateTypo: true,
      validateDisposable: true,
      validateSMTP: true,
    });
    if (!valid) {
      return res.status(400).json({ message: `Invalid email address. Reason: ${validators[reason]?.reason || reason}` });
    }

    await initTransporter();

    // The inviter is the currently logged-in user
    const inviterName = req.user.name;
    const inviterEmail = req.user.email;
    const platformName = 'IntellMeet';
    const appLink = process.env.CLIENT_URL || 'http://localhost:5173';

    const mailOptions = {
      from: `"${inviterName} via ${platformName}" <no-reply@intellmeet.com>`,
      to: email,
      subject: `You have been invited to collaborate on ${platformName}`,
      text: `Hello!\n\n${inviterName} (${inviterEmail}) has invited you to join their workspace on ${platformName}.\n\nClick the link below to get started:\n${appLink}\n\nWelcome aboard!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #0b0f19;">Invitation to ${platformName}</h2>
          <p>Hello,</p>
          <p><strong>${inviterName}</strong> (${inviterEmail}) has invited you to collaborate in their team space on ${platformName}.</p>
          <p>IntellMeet is an AI-powered collaboration platform designed for high-performance teams.</p>
          <a href="${appLink}" style="display: inline-block; padding: 12px 24px; background-color: #0ea5e9; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 10px;">Join the Workspace</a>
          <p style="margin-top: 20px; color: #6b7280; font-size: 12px;">If you weren't expecting this invitation, you can safely ignore this email.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`📩 Invitation sent to ${email}`);
    
    // If using Ethereal, log the preview URL to the terminal
    if (!process.env.SMTP_HOST) {
      console.log('🔗 Ethereal Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }

    res.status(200).json({ message: 'Invitation email successfully dispatched', previewUrl: nodemailer.getTestMessageUrl(info) });
  } catch (err) {
    console.error('Email send error:', err);
    res.status(500).json({ message: 'Failed to send invitation email' });
  }
});

export default router;
