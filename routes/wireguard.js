'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const wireguardService = require('../services/wireguardService');

/**
 * Guard: return 503 when WireGuard integration is disabled.
 */
function requireWireGuard(req, res, next) {
  if (process.env.WIREGUARD_ENABLED !== 'true') {
    return res.status(503).json({
      success: false,
      message: 'WireGuard integration is not enabled',
    });
  }
  return next();
}

// ── Interface endpoints ───────────────────────────────────────────────────────

// GET /api/wireguard/:routerId/interfaces
router.get(
  '/:routerId/interfaces',
  authenticate,
  requireRole('viewer'),
  requireWireGuard,
  async (req, res) => {
    try {
      const routerId = parseInt(req.params.routerId);
      if (!routerId) return res.status(400).json({ success: false, message: 'Invalid router ID' });

      const interfaces = await wireguardService.listInterfaces(routerId);
      return res.json({ success: true, message: 'WireGuard interfaces retrieved', data: { interfaces } });
    } catch (err) {
      console.error('[wireguard GET /:routerId/interfaces]', err);
      if (err.message && err.message.includes('not found')) {
        return res.status(404).json({ success: false, message: err.message });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

// GET /api/wireguard/:routerId/interfaces/:name
router.get(
  '/:routerId/interfaces/:name',
  authenticate,
  requireRole('viewer'),
  requireWireGuard,
  async (req, res) => {
    try {
      const routerId = parseInt(req.params.routerId);
      if (!routerId) return res.status(400).json({ success: false, message: 'Invalid router ID' });

      const iface = await wireguardService.getInterface(routerId, req.params.name);
      return res.json({ success: true, message: 'WireGuard interface retrieved', data: { interface: iface } });
    } catch (err) {
      console.error('[wireguard GET /:routerId/interfaces/:name]', err);
      if (err.message && err.message.includes('not found')) {
        return res.status(404).json({ success: false, message: err.message });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

// POST /api/wireguard/:routerId/interfaces — super_admin only
router.post(
  '/:routerId/interfaces',
  authenticate,
  requireRole('super_admin'),
  requireWireGuard,
  async (req, res) => {
    try {
      const routerId = parseInt(req.params.routerId);
      if (!routerId) return res.status(400).json({ success: false, message: 'Invalid router ID' });

      const { name, listenPort, privateKey, mtu } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, message: 'name is required' });
      }

      const result = await wireguardService.createInterface(routerId, { name, listenPort, privateKey, mtu });
      return res.status(201).json({ success: true, message: 'WireGuard interface created', data: { result } });
    } catch (err) {
      console.error('[wireguard POST /:routerId/interfaces]', err);
      if (err.message && err.message.includes('not found')) {
        return res.status(404).json({ success: false, message: err.message });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

// PUT /api/wireguard/:routerId/interfaces/:name — super_admin only
router.put(
  '/:routerId/interfaces/:name',
  authenticate,
  requireRole('super_admin'),
  requireWireGuard,
  async (req, res) => {
    try {
      const routerId = parseInt(req.params.routerId);
      if (!routerId) return res.status(400).json({ success: false, message: 'Invalid router ID' });

      const { listenPort, privateKey, mtu } = req.body;
      const result = await wireguardService.updateInterface(routerId, req.params.name, { listenPort, privateKey, mtu });
      return res.json({ success: true, message: 'WireGuard interface updated', data: { result } });
    } catch (err) {
      console.error('[wireguard PUT /:routerId/interfaces/:name]', err);
      if (err.message && err.message.includes('not found')) {
        return res.status(404).json({ success: false, message: err.message });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

// DELETE /api/wireguard/:routerId/interfaces/:name — super_admin only
router.delete(
  '/:routerId/interfaces/:name',
  authenticate,
  requireRole('super_admin'),
  requireWireGuard,
  async (req, res) => {
    try {
      const routerId = parseInt(req.params.routerId);
      if (!routerId) return res.status(400).json({ success: false, message: 'Invalid router ID' });

      await wireguardService.deleteInterface(routerId, req.params.name);
      return res.json({ success: true, message: 'WireGuard interface deleted successfully' });
    } catch (err) {
      console.error('[wireguard DELETE /:routerId/interfaces/:name]', err);
      if (err.message && err.message.includes('not found')) {
        return res.status(404).json({ success: false, message: err.message });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

// ── Peer endpoints ────────────────────────────────────────────────────────────

// GET /api/wireguard/:routerId/peers — optionally filter by ?interface=wg0
router.get(
  '/:routerId/peers',
  authenticate,
  requireRole('viewer'),
  requireWireGuard,
  async (req, res) => {
    try {
      const routerId = parseInt(req.params.routerId);
      if (!routerId) return res.status(400).json({ success: false, message: 'Invalid router ID' });

      const peers = await wireguardService.listPeers(routerId, req.query.interface);
      return res.json({ success: true, message: 'WireGuard peers retrieved', data: { peers } });
    } catch (err) {
      console.error('[wireguard GET /:routerId/peers]', err);
      if (err.message && err.message.includes('not found')) {
        return res.status(404).json({ success: false, message: err.message });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

// GET /api/wireguard/:routerId/peers/:publicKey — publicKey is URL-encoded
router.get(
  '/:routerId/peers/:publicKey',
  authenticate,
  requireRole('viewer'),
  requireWireGuard,
  async (req, res) => {
    try {
      const routerId = parseInt(req.params.routerId);
      if (!routerId) return res.status(400).json({ success: false, message: 'Invalid router ID' });

      const publicKey = decodeURIComponent(req.params.publicKey);
      const peer = await wireguardService.getPeer(routerId, publicKey);
      return res.json({ success: true, message: 'WireGuard peer retrieved', data: { peer } });
    } catch (err) {
      console.error('[wireguard GET /:routerId/peers/:publicKey]', err);
      if (err.message && err.message.includes('not found')) {
        return res.status(404).json({ success: false, message: err.message });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

// POST /api/wireguard/:routerId/peers — super_admin only
router.post(
  '/:routerId/peers',
  authenticate,
  requireRole('super_admin'),
  requireWireGuard,
  async (req, res) => {
    try {
      const routerId = parseInt(req.params.routerId);
      if (!routerId) return res.status(400).json({ success: false, message: 'Invalid router ID' });

      const { interfaceName, publicKey, allowedAddress, endpoint, presharedKey, comment, persistentKeepalive } = req.body;
      if (!interfaceName || !publicKey) {
        return res.status(400).json({ success: false, message: 'interfaceName and publicKey are required' });
      }

      const result = await wireguardService.createPeer(routerId, {
        interfaceName, publicKey, allowedAddress, endpoint, presharedKey, comment, persistentKeepalive,
      });
      return res.status(201).json({ success: true, message: 'WireGuard peer created', data: { result } });
    } catch (err) {
      console.error('[wireguard POST /:routerId/peers]', err);
      if (err.message && err.message.includes('not found')) {
        return res.status(404).json({ success: false, message: err.message });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

// PUT /api/wireguard/:routerId/peers/:publicKey — super_admin only
router.put(
  '/:routerId/peers/:publicKey',
  authenticate,
  requireRole('super_admin'),
  requireWireGuard,
  async (req, res) => {
    try {
      const routerId = parseInt(req.params.routerId);
      if (!routerId) return res.status(400).json({ success: false, message: 'Invalid router ID' });

      const publicKey = decodeURIComponent(req.params.publicKey);
      const { allowedAddress, endpoint, presharedKey, comment, persistentKeepalive } = req.body;
      const result = await wireguardService.updatePeer(routerId, publicKey, {
        allowedAddress, endpoint, presharedKey, comment, persistentKeepalive,
      });
      return res.json({ success: true, message: 'WireGuard peer updated', data: { result } });
    } catch (err) {
      console.error('[wireguard PUT /:routerId/peers/:publicKey]', err);
      if (err.message && err.message.includes('not found')) {
        return res.status(404).json({ success: false, message: err.message });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

// DELETE /api/wireguard/:routerId/peers/:publicKey — super_admin only
router.delete(
  '/:routerId/peers/:publicKey',
  authenticate,
  requireRole('super_admin'),
  requireWireGuard,
  async (req, res) => {
    try {
      const routerId = parseInt(req.params.routerId);
      if (!routerId) return res.status(400).json({ success: false, message: 'Invalid router ID' });

      const publicKey = decodeURIComponent(req.params.publicKey);
      await wireguardService.deletePeer(routerId, publicKey);
      return res.json({ success: true, message: 'WireGuard peer deleted successfully' });
    } catch (err) {
      console.error('[wireguard DELETE /:routerId/peers/:publicKey]', err);
      if (err.message && err.message.includes('not found')) {
        return res.status(404).json({ success: false, message: err.message });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

module.exports = router;
