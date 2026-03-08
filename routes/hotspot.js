'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const mikrotikService = require('../services/mikrotikService');
const Router = require('../models/Router');

// GET /api/hotspot/:routerId/users
router.get('/:routerId/users', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const routerId = parseInt(req.params.routerId);
    if (!routerId) return res.status(400).json({ success: false, message: 'Invalid router ID' });

    const users = await mikrotikService.listHotspotUsers(routerId);
    return res.json({ success: true, message: 'Hotspot users retrieved', data: { users } });
  } catch (err) {
    console.error('[hotspot GET /:routerId/users]', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

// POST /api/hotspot/:routerId/users
router.post('/:routerId/users', authenticate, requireRole('cashier'), async (req, res) => {
  try {
    const routerId = parseInt(req.params.routerId);
    if (!routerId) return res.status(400).json({ success: false, message: 'Invalid router ID' });

    const { username, password, profile, comment, limit_uptime } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'username and password are required' });
    }

    await mikrotikService.createHotspotUser(routerId, {
      username,
      password,
      profile,
      comment,
      limitUptime: limit_uptime,
    });

    return res.status(201).json({ success: true, message: 'Hotspot user created on router' });
  } catch (err) {
    console.error('[hotspot POST /:routerId/users]', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

// DELETE /api/hotspot/:routerId/users/:username
router.delete('/:routerId/users/:username', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const routerId = parseInt(req.params.routerId);
    if (!routerId) return res.status(400).json({ success: false, message: 'Invalid router ID' });

    await mikrotikService.deleteHotspotUser(routerId, req.params.username);
    return res.json({ success: true, message: 'Hotspot user deleted from router' });
  } catch (err) {
    console.error('[hotspot DELETE /:routerId/users/:username]', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

// POST /api/hotspot/:routerId/users/:username/disable
router.post('/:routerId/users/:username/disable', authenticate, requireRole('cashier'), async (req, res) => {
  try {
    const routerId = parseInt(req.params.routerId);
    if (!routerId) return res.status(400).json({ success: false, message: 'Invalid router ID' });

    await mikrotikService.disableHotspotUser(routerId, req.params.username);
    return res.json({ success: true, message: 'Hotspot user disabled' });
  } catch (err) {
    console.error('[hotspot POST /:routerId/users/:username/disable]', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

// POST /api/hotspot/:routerId/users/:username/enable
router.post('/:routerId/users/:username/enable', authenticate, requireRole('cashier'), async (req, res) => {
  try {
    const routerId = parseInt(req.params.routerId);
    if (!routerId) return res.status(400).json({ success: false, message: 'Invalid router ID' });

    await mikrotikService.enableHotspotUser(routerId, req.params.username);
    return res.json({ success: true, message: 'Hotspot user enabled' });
  } catch (err) {
    console.error('[hotspot POST /:routerId/users/:username/enable]', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

// GET /api/hotspot/:routerId/sessions
router.get('/:routerId/sessions', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const routerId = parseInt(req.params.routerId);
    if (!routerId) return res.status(400).json({ success: false, message: 'Invalid router ID' });

    const sessions = await mikrotikService.getActiveSessions(routerId);
    return res.json({ success: true, message: 'Active sessions retrieved', data: { sessions } });
  } catch (err) {
    console.error('[hotspot GET /:routerId/sessions]', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

// DELETE /api/hotspot/:routerId/sessions/:sessionId
router.delete('/:routerId/sessions/:sessionId', authenticate, requireRole('cashier'), async (req, res) => {
  try {
    const routerId = parseInt(req.params.routerId);
    if (!routerId) return res.status(400).json({ success: false, message: 'Invalid router ID' });

    await mikrotikService.disconnectSession(routerId, req.params.sessionId);
    return res.json({ success: true, message: 'Session disconnected' });
  } catch (err) {
    console.error('[hotspot DELETE /:routerId/sessions/:sessionId]', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

// GET /api/hotspot/:routerId/health
router.get('/:routerId/health', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const routerId = parseInt(req.params.routerId);
    if (!routerId) return res.status(400).json({ success: false, message: 'Invalid router ID' });

    const health = await mikrotikService.getRouterHealth(routerId);
    return res.json({ success: true, message: 'Router health retrieved', data: { health } });
  } catch (err) {
    console.error('[hotspot GET /:routerId/health]', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

// GET /api/hotspot/:routerId/interfaces
router.get('/:routerId/interfaces', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const routerId = parseInt(req.params.routerId);
    if (!routerId) return res.status(400).json({ success: false, message: 'Invalid router ID' });

    const interfaces = await mikrotikService.getInterfaces(routerId);
    return res.json({ success: true, message: 'Interfaces retrieved', data: { interfaces } });
  } catch (err) {
    console.error('[hotspot GET /:routerId/interfaces]', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

// POST /api/hotspot/:routerId/sync
router.post('/:routerId/sync', authenticate, requireRole('cashier'), async (req, res) => {
  try {
    const routerId = parseInt(req.params.routerId);
    if (!routerId) return res.status(400).json({ success: false, message: 'Invalid router ID' });

    const result = await mikrotikService.syncUsers(routerId);
    return res.json({ success: true, message: 'DB users synced with router', data: result });
  } catch (err) {
    console.error('[hotspot POST /:routerId/sync]', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

module.exports = router;
