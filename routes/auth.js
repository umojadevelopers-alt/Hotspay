'use strict';

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_change_in_production_only';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '24h';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findByEmail(email);
    if (!user || !(await User.comparePassword(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(401).json({ success: false, message: 'Account is disabled' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES,
      algorithm: 'HS256',
    });

    const { password: _p, ...userInfo } = user;
    return res.json({ success: true, message: 'Login successful', data: { token, user: userInfo } });
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/auth/register - open only for the very first user; super_admin for subsequent
router.post('/register', async (req, res) => {
  try {
    const existingUsers = await User.list({});
    const isFirstUser = existingUsers.length === 0;

    if (!isFirstUser) {
      // Manually verify Bearer token and check super_admin role
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }
      let decoded;
      try {
        decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET, { algorithms: ['HS256'] });
      } catch {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
      }
      if (decoded.role !== 'super_admin') {
        return res.status(403).json({ success: false, message: 'Access denied. Required role: super_admin' });
      }
    }

    const { name, email, password, role = 'viewer' } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    const validRoles = ['super_admin', 'cashier', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: `Role must be one of: ${validRoles.join(', ')}` });
    }

    if (await User.findByEmail(email)) {
      return res.status(409).json({ success: false, message: 'Email is already in use' });
    }

    const created = await User.create({ name, email, password, role });
    const { password: _p, ...userInfo } = created;
    return res.status(201).json({ success: true, message: 'User registered successfully', data: { user: userInfo } });
  } catch (err) {
    console.error('[auth/register]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, (req, res) => {
  // JWT is stateless; client should discard the token
  return res.json({
    success: true,
    message: 'Logged out successfully. Please discard your token on the client side.',
  });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const { password: _p, ...userInfo } = user;
    return res.json({ success: true, message: 'User info retrieved', data: { user: userInfo } });
  } catch (err) {
    console.error('[auth/me]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PUT /api/auth/me/password
router.put('/me/password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'current_password and new_password are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'new_password must be at least 6 characters' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const valid = await User.comparePassword(current_password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    await User.update(user.id, { password: new_password });
    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('[auth/me/password]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/auth/users - super_admin only
router.get('/users', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const { role, is_active, search } = req.query;
    const filters = {};
    if (role) filters.role = role;
    if (is_active !== undefined) filters.is_active = is_active === 'true' || is_active === '1';
    if (search) filters.search = search;

    const users = await User.list(filters);
    return res.json({ success: true, message: 'Users retrieved', data: { users } });
  } catch (err) {
    console.error('[auth/users]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PUT /api/auth/users/:id - super_admin only
router.put('/users/:id', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid user ID' });

    const existing = await User.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'User not found' });

    const allowedFields = ['name', 'email', 'role', 'is_active', 'password'];
    const data = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    }

    if (data.role) {
      const validRoles = ['super_admin', 'cashier', 'viewer'];
      if (!validRoles.includes(data.role)) {
        return res.status(400).json({ success: false, message: `Role must be one of: ${validRoles.join(', ')}` });
      }
    }

    if (data.email && data.email !== existing.email) {
      const emailUser = await User.findByEmail(data.email);
      if (emailUser) return res.status(409).json({ success: false, message: 'Email is already in use' });
    }

    const updated = await User.update(id, data);
    const { password: _p, ...userInfo } = updated;
    return res.json({ success: true, message: 'User updated successfully', data: { user: userInfo } });
  } catch (err) {
    console.error('[auth/users/:id PUT]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// DELETE /api/auth/users/:id - super_admin only
router.delete('/users/:id', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid user ID' });

    if (id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }

    const existing = await User.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'User not found' });

    await User.delete(id);
    return res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('[auth/users/:id DELETE]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
