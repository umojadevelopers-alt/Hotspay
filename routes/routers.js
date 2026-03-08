'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const Router = require('../models/Router');
const mikrotikService = require('../services/mikrotikService');

// GET /api/routers
router.get('/', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const routers = await Router.list();
    // Strip api_password from response for security
    const sanitized = routers.map(({ api_password: _p, ...r }) => r);
    return res.json({ success: true, message: 'Routers retrieved', data: { routers: sanitized } });
  } catch (err) {
    console.error('[routers GET /]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/routers - super_admin only
router.post('/', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const { name, host, port, api_user, api_password, is_active, ssid, location } = req.body;
    if (!name || !host || !api_user || !api_password) {
      return res.status(400).json({
        success: false,
        message: 'name, host, api_user, and api_password are required',
      });
    }

    const created = await Router.create({ name, host, port, api_user, api_password, is_active, ssid, location });
    const { api_password: _p, ...routerInfo } = created;
    return res.status(201).json({ success: true, message: 'Router created', data: { router: routerInfo } });
  } catch (err) {
    console.error('[routers POST /]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/routers/:id
router.get('/:id', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid router ID' });

    const routerRecord = await Router.findById(id);
    if (!routerRecord) return res.status(404).json({ success: false, message: 'Router not found' });

    const { api_password: _p, ...routerInfo } = routerRecord;
    return res.json({ success: true, message: 'Router retrieved', data: { router: routerInfo } });
  } catch (err) {
    console.error('[routers GET /:id]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PUT /api/routers/:id - super_admin only
router.put('/:id', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid router ID' });

    const existing = await Router.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Router not found' });

    const { name, host, port, api_user, api_password, is_active, ssid, location } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (host !== undefined) data.host = host;
    if (port !== undefined) data.port = parseInt(port);
    if (api_user !== undefined) data.api_user = api_user;
    if (api_password !== undefined) data.api_password = api_password;
    if (is_active !== undefined) data.is_active = is_active;
    if (ssid !== undefined) data.ssid = ssid;
    if (location !== undefined) data.location = location;

    const updated = await Router.update(id, data);
    const { api_password: _p, ...routerInfo } = updated;
    return res.json({ success: true, message: 'Router updated', data: { router: routerInfo } });
  } catch (err) {
    console.error('[routers PUT /:id]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// DELETE /api/routers/:id - super_admin only
router.delete('/:id', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid router ID' });

    const existing = await Router.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Router not found' });

    await Router.delete(id);
    return res.json({ success: true, message: 'Router deleted successfully' });
  } catch (err) {
    console.error('[routers DELETE /:id]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/routers/:id/test - test router connection
router.post('/:id/test', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid router ID' });

    const existing = await Router.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Router not found' });

    const health = await mikrotikService.getRouterHealth(id);
    return res.json({ success: true, message: 'Router connection successful', data: { health } });
  } catch (err) {
    console.error('[routers POST /:id/test]', err);
    return res.status(500).json({ success: false, message: err.message || 'Unable to connect to router' });
  }
});

module.exports = router;
