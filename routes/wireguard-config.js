'use strict';

const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { WireGuardServer, WireGuardPeer } = require('../models/WireGuard');
const crypto = require('crypto');

// Generate WireGuard key pair (simulated - in production, use actual wg command)
function generateKeyPair() {
  // In production on Linux, you would use: wg genkey | tee privatekey | wg pubkey > publickey
  // For now, generate random base64 strings as placeholders
  const privateKey = crypto.randomBytes(32).toString('base64');
  const publicKey = crypto.randomBytes(32).toString('base64');
  return { privateKey, publicKey };
}

// GET /api/wireguard-config/server - Get server configuration
router.get('/server', authenticate, async (req, res) => {
  try {
    let config = await WireGuardServer.getConfig();
    
    if (!config) {
      // Return default config structure
      config = {
        server_endpoint: '',
        server_port: 51820,
        public_key: '',
        network_address: '10.10.10.0/24',
        server_ip: '10.10.10.1',
        is_active: false
      };
    }
    
    // Don't expose private key to frontend
    delete config.private_key;
    
    return res.json({ success: true, data: { config } });
  } catch (err) {
    console.error('[wireguard-config GET /server]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/wireguard-config/server - Save server configuration
router.post('/server', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const { server_endpoint, server_port, public_key, private_key } = req.body;
    
    if (!server_endpoint) {
      return res.status(400).json({ success: false, message: 'Server endpoint is required' });
    }
    
    const config = await WireGuardServer.saveConfig({
      server_endpoint,
      server_port: server_port || 51820,
      public_key: public_key || '',
      private_key: private_key || '',
      is_active: true
    });
    
    // Don't return private key
    delete config.private_key;
    
    return res.json({ success: true, message: 'Server config saved', data: { config } });
  } catch (err) {
    console.error('[wireguard-config POST /server]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/wireguard-config/peers - List all peers
router.get('/peers', authenticate, async (req, res) => {
  try {
    const peers = await WireGuardPeer.findAll();
    return res.json({ success: true, data: { peers } });
  } catch (err) {
    console.error('[wireguard-config GET /peers]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/wireguard-config/peers/next-ip - Get next available IP
router.get('/peers/next-ip', authenticate, async (req, res) => {
  try {
    const nextIp = await WireGuardPeer.getNextIP();
    return res.json({ success: true, data: { nextIp } });
  } catch (err) {
    console.error('[wireguard-config GET /peers/next-ip]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/wireguard-config/peers - Create peer
router.post('/peers', authenticate, requireRole('cashier'), async (req, res) => {
  try {
    const { router_id, peer_name, lan_network, listen_port } = req.body;
    
    if (!peer_name) {
      return res.status(400).json({ success: false, message: 'Peer name is required' });
    }
    
    // Get next available IP
    const wireguard_ip = await WireGuardPeer.getNextIP();
    
    const peer = await WireGuardPeer.create({
      router_id: router_id || null,
      peer_name,
      wireguard_ip,
      lan_network: lan_network || '192.168.88.0/24',
      listen_port: listen_port || 13231,
      status: 'pending'
    });
    
    return res.status(201).json({ success: true, message: 'Peer created', data: { peer } });
  } catch (err) {
    console.error('[wireguard-config POST /peers]', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

// PUT /api/wireguard-config/peers/:id - Update peer (e.g., add public key after MikroTik setup)
router.put('/peers/:id', authenticate, requireRole('cashier'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const peer = await WireGuardPeer.update(id, req.body);
    
    if (!peer) {
      return res.status(404).json({ success: false, message: 'Peer not found' });
    }
    
    return res.json({ success: true, message: 'Peer updated', data: { peer } });
  } catch (err) {
    console.error('[wireguard-config PUT /peers/:id]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// DELETE /api/wireguard-config/peers/:id - Delete peer
router.delete('/peers/:id', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await WireGuardPeer.delete(id);
    return res.json({ success: true, message: 'Peer deleted' });
  } catch (err) {
    console.error('[wireguard-config DELETE /peers/:id]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/wireguard-config/peers/:id/rsc - Generate RSC script for peer
router.get('/peers/:id/rsc', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const peer = await WireGuardPeer.findById(id);
    
    if (!peer) {
      return res.status(404).json({ success: false, message: 'Peer not found' });
    }
    
    const serverConfig = await WireGuardServer.getConfig();
    
    if (!serverConfig || !serverConfig.public_key) {
      return res.status(400).json({ success: false, message: 'Server not configured. Please set up server first.' });
    }
    
    const script = generateRscScript(peer, serverConfig);
    
    return res.json({ success: true, data: { script, peer } });
  } catch (err) {
    console.error('[wireguard-config GET /peers/:id/rsc]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Generate RSC script for MikroTik
function generateRscScript(peer, serverConfig) {
  const timestamp = new Date().toISOString();
  
  return `# =====================================================
# Hotspay WireGuard Configuration
# Router: ${peer.peer_name}
# Generated: ${timestamp}
# =====================================================

# Step 1: Create WireGuard interface
/interface wireguard
add name=wg-hotspay listen-port=${peer.listen_port || 13231} comment="Hotspay VPN Tunnel"

# Step 2: Get your public key
# IMPORTANT: After running this script, copy the public key and update it in Hotspay dashboard!
:delay 1s
:local pubKey [/interface wireguard get wg-hotspay public-key]
:put "========================================"
:put "ROUTER PUBLIC KEY - Copy this to Hotspay Dashboard:"
:put \\$pubKey
:put "========================================"

# Step 3: Assign IP to WireGuard interface
/ip address
add address=${peer.wireguard_ip}/24 interface=wg-hotspay comment="Hotspay WG IP"

# Step 4: Add Hotspay server as peer
/interface wireguard peers
add interface=wg-hotspay \\
    public-key="${serverConfig.public_key}" \\
    endpoint-address=${serverConfig.server_endpoint} \\
    endpoint-port=${serverConfig.server_port || 51820} \\
    allowed-address=10.10.10.0/24 \\
    persistent-keepalive=25 \\
    comment="Hotspay Server"

# Step 5: Firewall - Allow WireGuard traffic
/ip firewall filter
add chain=input protocol=udp dst-port=${peer.listen_port || 13231} action=accept comment="Allow WireGuard Hotspay" place-before=0

# Step 6: Add route to server network
/ip route
add dst-address=10.10.10.1/32 gateway=wg-hotspay comment="Hotspay Server Route"

# =====================================================
# VERIFICATION COMMANDS:
# =====================================================
# /interface wireguard print
# /interface wireguard peers print detail
# /ping 10.10.10.1
# =====================================================

# NEXT STEP: 
# 1. Copy the public key shown above
# 2. Go to Hotspay Dashboard > WireGuard
# 3. Click "Update Public Key" for this router
# 4. Paste the public key and save
`;
}

// GET /api/wireguard-config/server/wg-conf - Generate server wg0.conf
router.get('/server/wg-conf', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const serverConfig = await WireGuardServer.getConfig();
    
    if (!serverConfig) {
      return res.status(400).json({ success: false, message: 'Server not configured' });
    }
    
    const peers = await WireGuardPeer.findAll();
    const activePeers = peers.filter(p => p.public_key);
    
    let conf = `[Interface]
# Hotspay WireGuard Server
Address = ${serverConfig.server_ip}/24
ListenPort = ${serverConfig.server_port || 51820}
PrivateKey = ${serverConfig.private_key || 'YOUR_PRIVATE_KEY_HERE'}

PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
`;

    for (const peer of activePeers) {
      conf += `
[Peer]
# ${peer.peer_name}
PublicKey = ${peer.public_key}
AllowedIPs = ${peer.wireguard_ip}/32${peer.lan_network ? ', ' + peer.lan_network : ''}
PersistentKeepalive = 25
`;
    }
    
    return res.json({ success: true, data: { config: conf, peersCount: activePeers.length } });
  } catch (err) {
    console.error('[wireguard-config GET /server/wg-conf]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
