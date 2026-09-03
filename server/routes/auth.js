const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { generateToken, verifyToken } = require('../middleware/auth');

const router = express.Router();

// Helper to compare password (supports bcrypt hash or plain text from seed data)
function checkPassword(inputPassword, storedPassword) {
  if (!storedPassword || !inputPassword) return false;
  if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$')) {
    return bcrypt.compareSync(inputPassword, storedPassword);
  }
  return inputPassword === storedPassword;
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  try {
    const { name, email, password, role = 'student', avatar = '🎓' } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Please enter your full name.' });
    }
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    const existingUser = db.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    const newUser = db.createUser({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: role === 'admin' ? 'admin' : 'student',
      avatar: avatar || '🎓'
    });

    const token = generateToken(newUser);
    const safeUser = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      avatar: newUser.avatar,
      createdAt: newUser.createdAt
    };

    return res.status(201).json({
      success: true,
      message: `Welcome, ${safeUser.name}! Your account has been created.`,
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please enter both email and password.' });
    }

    const user = db.getUserByEmail(email);
    if (!user || !checkPassword(password, user.password)) {
      return res.status(401).json({ success: false, message: 'Invalid email or password. Please try again.' });
    }

    const token = generateToken(user);
    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      createdAt: user.createdAt
    };

    return res.json({
      success: true,
      message: `Welcome back, ${safeUser.name}!`,
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// POST /api/auth/google - Authenticate or Register with Google/Gmail
router.post('/google', (req, res) => {
  try {
    const { email, name, avatar = '🎓', role = 'student', googleId } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid Google email is required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    let user = db.getUserByEmail(cleanEmail);

    if (!user) {
      // Create new Google-authenticated user
      const cleanName = name && name.trim() ? name.trim() : cleanEmail.split('@')[0];
      user = db.createUser({
        name: cleanName,
        email: cleanEmail,
        password: `google_oauth_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        role: role === 'admin' ? 'admin' : 'student',
        avatar: avatar || '🎓',
        isGoogleAuth: true,
        googleId: googleId || `gid_${Date.now()}`
      });
    } else {
      // Update avatar if not set
      if (!user.avatar && avatar) {
        db.updateUser(user.id, { avatar });
      }
    }

    const token = generateToken(user);
    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      createdAt: user.createdAt
    };

    return res.json({
      success: true,
      message: `Signed in as ${safeUser.name} (${safeUser.email}) via Google`,
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Google auth error:', err);
    return res.status(500).json({ success: false, message: 'Server error during Google authentication.' });
  }
});

// POST /api/auth/demo
router.post('/demo', (req, res) => {
  try {
    const { role = 'student' } = req.body;
    const targetEmail = role === 'admin' ? 'admin@quiz.com' : 'student@quiz.com';

    let user = db.getUserByEmail(targetEmail);
    if (!user) {
      db.seedDefaults();
      user = db.getUserByEmail(targetEmail);
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'Demo account not found.' });
    }

    const token = generateToken(user);
    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar
    };

    return res.json({
      success: true,
      message: `Logged in as Demo ${role === 'admin' ? 'Administrator' : 'Student'} (${safeUser.name})`,
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Demo login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during demo login.' });
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, (req, res) => {
  const user = db.getUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }
  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    createdAt: user.createdAt
  };
  return res.json({ success: true, user: safeUser });
});

// PUT /api/auth/profile
router.put('/profile', verifyToken, (req, res) => {
  try {
    const { name, email, avatar, currentPassword, newPassword } = req.body;
    const user = db.getUserById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const updates = {};
    if (name && name.trim()) updates.name = name.trim();
    if (avatar) updates.avatar = avatar;

    if (email && email.toLowerCase().trim() !== user.email.toLowerCase()) {
      const existing = db.getUserByEmail(email);
      if (existing && existing.id !== user.id) {
        return res.status(409).json({ success: false, message: 'This email is already registered to another user.' });
      }
      updates.email = email.toLowerCase().trim();
    }

    if (newPassword && newPassword.trim()) {
      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
      }
      if (!currentPassword || !checkPassword(currentPassword, user.password)) {
        return res.status(400).json({ success: false, message: 'The current password you entered is incorrect.' });
      }
      const salt = bcrypt.genSaltSync(10);
      updates.password = bcrypt.hashSync(newPassword, salt);
    }

    const updatedUser = db.updateUser(user.id, updates);
    const token = generateToken(updatedUser);

    const safeUser = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      avatar: updatedUser.avatar,
      createdAt: updatedUser.createdAt
    };

    return res.json({
      success: true,
      message: 'Profile updated successfully!',
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Profile update error:', err);
    return res.status(500).json({ success: false, message: 'Server error updating profile.' });
  }
});

module.exports = router;
