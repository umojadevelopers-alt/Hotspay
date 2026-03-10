'use strict';

const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const mikrotikService = require('../services/mikrotikService');
const { WireGuardPeer } = require('../models/WireGuard');

// POST /api/wireguard-mikrotik/push-config/:peerId
router.post('/push-config/:peerId', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const peerId = parseInt(req.params.peerId);
    const peer = await WireGuardPeer.findById(peerId);
    if (!peer) return res.status(404).json({ success: false, message: 'Peer not found' });
    if (!peer.router_id) return res.status(400).json({ success: false, message: 'Router not linked' });
    if (!req.body.script) return res.status(400).json({ success: false, message: 'Script required' });

    // Split script into lines
    const scriptLines = req.body.script.split('\n').map(l => l.trim()).filter(l => l);
    const result = await mikrotikService.pushWireGuardConfig(peer.router_id, scriptLines);
    if (!result.success) return res.status(500).json({ success: false, message: result.error });
    return res.json({ success: true, message: 'Config pushed to MikroTik' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/wireguard-mikrotik/public-key/:peerId
router.get('/public-key/:peerId', authenticate, async (req, res) => {
  try {
    const peerId = parseInt(req.params.peerId);
    const peer = await WireGuardPeer.findById(peerId);
    if (!peer) return res.status(404).json({ success: false, message: 'Peer not found' });
    if (!peer.router_id) return res.status(400).json({ success: false, message: 'Router not linked' });
    const pubKey = await mikrotikService.getWireGuardPublicKey(peer.router_id, 'wg-hotspay');
    if (!pubKey) return res.status(404).json({ success: false, message: 'Public key not found' });
    return res.json({ success: true, data: { publicKey: pubKey } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
