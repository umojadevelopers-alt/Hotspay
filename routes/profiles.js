'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const Profile = require('../models/Profile');
const mikrotikService = require('../services/mikrotikService');

// GET /api/profiles
router.get('/', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const routerId = req.query.routerId ? parseInt(req.query.routerId) : null;
    const profiles = await Profile.list(routerId);
    return res.json({ success: true, message: 'Profiles retrieved', data: { profiles } });
  } catch (err) {
    console.error('[profiles GET /]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/profiles
router.post('/', authenticate, requireRole('cashier'), async (req, res) => {
  try {
    const { name, router_id, rate_limit, session_timeout, shared_users, price, description } = req.body;
    if (!name || !router_id) {
      return res.status(400).json({ success: false, message: 'name and router_id are required' });
    }

    const profile = await Profile.create({
      name,
      router_id: parseInt(router_id),
      rate_limit,
      session_timeout,
      shared_users: shared_users !== undefined ? parseInt(shared_users) : 1,
      price: price !== undefined ? parseFloat(price) : 0,
      description,
    });

    return res.status(201).json({ success: true, message: 'Profile created', data: { profile } });
  } catch (err) {
    console.error('[profiles POST /]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/profiles/:id
router.get('/:id', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid profile ID' });

    const profile = await Profile.findById(id);
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    return res.json({ success: true, message: 'Profile retrieved', data: { profile } });
  } catch (err) {
    console.error('[profiles GET /:id]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PUT /api/profiles/:id
router.put('/:id', authenticate, requireRole('cashier'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid profile ID' });

    const existing = await Profile.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Profile not found' });

    const { name, router_id, rate_limit, session_timeout, shared_users, price, description } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (router_id !== undefined) data.router_id = parseInt(router_id);
    if (rate_limit !== undefined) data.rate_limit = rate_limit;
    if (session_timeout !== undefined) data.session_timeout = session_timeout;
    if (shared_users !== undefined) data.shared_users = parseInt(shared_users);
    if (price !== undefined) data.price = parseFloat(price);
    if (description !== undefined) data.description = description;

    const updated = await Profile.update(id, data);
    return res.json({ success: true, message: 'Profile updated', data: { profile: updated } });
  } catch (err) {
    console.error('[profiles PUT /:id]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// DELETE /api/profiles/:id - super_admin only
router.delete('/:id', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid profile ID' });

    const existing = await Profile.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Profile not found' });

    await Profile.delete(id);
    return res.json({ success: true, message: 'Profile deleted successfully' });
  } catch (err) {
    console.error('[profiles DELETE /:id]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/profiles/:id/push - push profile to MikroTik router
router.post('/:id/push', authenticate, requireRole('cashier'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid profile ID' });

    const profile = await Profile.findById(id);
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    await mikrotikService.createProfile(profile.router_id, {
      name: profile.name,
      rateLimit: profile.rate_limit || '',
      sessionTimeout: profile.session_timeout || '',
    });

    return res.json({ success: true, message: 'Profile pushed to MikroTik router' });
  } catch (err) {
    console.error('[profiles POST /:id/push]', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

module.exports = router;
