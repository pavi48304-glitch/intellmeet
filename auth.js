import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import { validate as validateEmail } from 'deep-email-validator';
import { OAuth2Client } from 'google-auth-library';

const router = express.Router();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (id) => {
  if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable is strictly required in production.');
  }
  return jwt.sign(
    { id }, 
    process.env.JWT_SECRET || 'dev_local_secret', 
    { expiresIn: '30d' }
  );
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
  const { name, email, password, avatar } = req.body;

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please enter all fields' });
    }

    const cleanEmail = email.toLowerCase().trim();
    
    // Validate email existence
    const { valid, reason, validators } = await validateEmail({
      email: cleanEmail,
      validateRegex: true,
      validateMx: true,
      validateTypo: true,
      validateDisposable: true,
      validateSMTP: true,
    });
    if (!valid) {
      return res.status(400).json({ message: `Invalid email address. Reason: ${validators[reason]?.reason || reason}` });
    }

    // Check if user exists
    let existingUser = await User.findOne({ email: cleanEmail });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const defaultAvatar = avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;

    const newUser = await User.create({
      name,
      email: cleanEmail,
      passwordHash,
      avatar: defaultAvatar,
      role: 'Member'
    });

    res.status(201).json({
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      avatar: newUser.avatar,
      role: newUser.role,
      token: generateToken(newUser._id)
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Please enter all fields' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // If the user signed up via Google and has no password, deny local login
    if (user.authProvider === 'google' && !user.passwordHash) {
      return res.status(400).json({ message: 'Please log in with Google.' });
    }

    // Match password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      token: generateToken(user._id)
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// @desc    Authenticate with Google OAuth
// @route   POST /api/auth/google
// @access  Public
router.post('/google', async (req, res) => {
  const { credential } = req.body;

  try {
    if (!credential) {
      return res.status(400).json({ message: 'No Google credential provided' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;
    const cleanEmail = email.toLowerCase().trim();

    let user = await User.findOne({ email: cleanEmail });
    if (!user) {
      user = await User.create({
        name,
        email: cleanEmail,
        googleId,
        authProvider: 'google',
        avatar: picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
        role: 'Member'
      });
    } else if (!user.googleId) {
      // Link Google ID to existing account
      user.googleId = googleId;
      user.authProvider = 'google';
      if (!user.avatar || user.avatar.includes('dicebear')) {
        user.avatar = picture;
      }
      await user.save();
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      token: generateToken(user._id)
    });
  } catch (error) {
    console.error('Google Auth error:', error);
    res.status(500).json({ message: 'Failed to authenticate with Google' });
  }
});

// @desc    Simple SSO fallback for manual provider prompts (no token verification)
// @route   POST /api/auth/sso
// @access  Public
router.post('/sso', async (req, res) => {
  const { email, name, provider } = req.body;

  try {
    if (!email || !name || !provider) {
      return res.status(400).json({ message: 'Missing SSO fields' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Basic email validation using deep-email-validator (non-SMTP checks only)
    const { valid, reason, validators } = await validateEmail({
      email: cleanEmail,
      validateRegex: true,
      validateMx: false,
      validateTypo: true,
      validateDisposable: true,
      validateSMTP: false,
    });
    if (!valid) {
      return res.status(400).json({ message: `Invalid email address. Reason: ${validators[reason]?.reason || reason}` });
    }

    // Normalize provider to match allowed enum values
    let providerKey = String(provider).toLowerCase();
    if (!['google', 'microsoft', 'apple', 'github'].includes(providerKey)) {
      providerKey = 'local';
    }

    let user = await User.findOne({ email: cleanEmail });
    if (!user) {
      user = await User.create({
        name,
        email: cleanEmail,
        authProvider: providerKey,
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
        role: 'Member'
      });
    } else {
      // Link provider if not set
      if (!user.authProvider || user.authProvider === 'local') user.authProvider = providerKey;
      if (!user.avatar || user.avatar.includes('dicebear')) {
        user.avatar = user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;
      }
      await user.save();
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      token: generateToken(user._id)
    });
  } catch (error) {
    console.error('SSO fallback error:', error);
    res.status(500).json({ message: 'Failed to process SSO request' });
  }
});

// @desc    Get user profile
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
  res.json(req.user);
});

// @desc    Update user profile / avatar
// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', protect, async (req, res) => {
  const { name, avatar } = req.body;

  try {
    let updatedUser = null;
    const user = await User.findById(req.user._id);
    if (user) {
      if (name) user.name = name;
      if (avatar) user.avatar = avatar;
      updatedUser = await user.save();
    }

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      avatar: updatedUser.avatar,
      role: updatedUser.role
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error during profile update' });
  }
});

// @desc    Get total count of registered users
// @route   GET /api/auth/users/count
// @access  Private
router.get('/users/count', protect, async (req, res) => {
  try {
    const count = await User.countDocuments({});
    // Return count. Let's make sure it is at least 1 (the current user).
    res.json({ count: count || 1 });
  } catch (error) {
    console.error('Count users error:', error);
    res.status(500).json({ message: 'Server error retrieving user count' });
  }
});

// Development-only helper: create a local user with password (not for production)
// @route POST /api/auth/dev-create-user
// @access Public (dev only)
router.post('/dev-create-user', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ message: 'Not allowed in production' });
  }

  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'name, email, and password are required' });
  }

  try {
    const cleanEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name,
      email: cleanEmail,
      passwordHash,
      authProvider: 'local',
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
      role: role || 'Member'
    });

    res.status(201).json({
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      avatar: newUser.avatar,
      role: newUser.role,
      token: generateToken(newUser._id)
    });
  } catch (error) {
    console.error('Dev create user error:', error);
    res.status(500).json({ message: 'Failed to create dev user' });
  }
});

export default router;
