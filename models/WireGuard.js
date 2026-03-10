'use strict';

const { query } = require('../config/database');

const WireGuardServer = {
  /**
   * Get server config
   */
  async getConfig() {
    const [rows] = await query('SELECT * FROM wireguard_server LIMIT 1');
    return rows || null;
  },

  /**
   * Create or update server config
   */
  async saveConfig(config) {
    const existing = await this.getConfig();
    
    if (existing) {
      const sql = `
        UPDATE wireguard_server SET
          server_endpoint = ?,
          server_port = ?,
          private_key = ?,
          public_key = ?,
          network_address = ?,
          server_ip = ?,
          is_active = ?,
          updated_at = NOW()
        WHERE id = ?
      `;
      await query(sql, [
        config.server_endpoint,
        config.server_port || 51820,
        config.private_key,
        config.public_key,
        config.network_address || '10.10.10.0/24',
        config.server_ip || '10.10.10.1',
        config.is_active !== false,
        existing.id
      ]);
      return { ...existing, ...config };
    } else {
      const sql = `
        INSERT INTO wireguard_server 
        (server_endpoint, server_port, private_key, public_key, network_address, server_ip, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      const [result] = await query(sql, [
        config.server_endpoint,
        config.server_port || 51820,
        config.private_key,
        config.public_key,
        config.network_address || '10.10.10.0/24',
        config.server_ip || '10.10.10.1',
        config.is_active !== false
      ]);
      return { id: result.insertId, ...config };
    }
  }
};

const WireGuardPeer = {
  /**
   * Get all peers
   */
  async findAll() {
    const sql = `
      SELECT wp.*, r.name as router_name, r.host as router_host
      FROM wireguard_peers wp
      LEFT JOIN routers r ON wp.router_id = r.id
      ORDER BY wp.id ASC
    `;
    const rows = await query(sql);
    return rows;
  },

  /**
   * Get peer by ID
   */
  async findById(id) {
    const sql = 'SELECT * FROM wireguard_peers WHERE id = ?';
    const [rows] = await query(sql, [id]);
    return rows || null;
  },

  /**
   * Get peer by router ID
   */
  async findByRouterId(routerId) {
    const sql = 'SELECT * FROM wireguard_peers WHERE router_id = ?';
    const [rows] = await query(sql, [routerId]);
    return rows || null;
  },

  /**
   * Get next available IP
   */
  async getNextIP() {
    const sql = 'SELECT wireguard_ip FROM wireguard_peers ORDER BY id DESC LIMIT 1';
    const rows = await query(sql);
    
    if (rows.length === 0) {
      return '10.10.10.2';
    }
    
    const lastIp = rows[0].wireguard_ip;
    const parts = lastIp.split('.');
    const lastOctet = parseInt(parts[3]) + 1;
    
    if (lastOctet > 254) {
      throw new Error('No more IPs available in subnet');
    }
    
    return `10.10.10.${lastOctet}`;
  },

  /**
   * Create peer
   */
  async create(data) {
    const sql = `
      INSERT INTO wireguard_peers 
      (router_id, peer_name, public_key, wireguard_ip, lan_network, listen_port, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await query(sql, [
      data.router_id || null,
      data.peer_name,
      data.public_key || null,
      data.wireguard_ip,
      data.lan_network || null,
      data.listen_port || 13231,
      data.status || 'pending'
    ]);
    return { id: result.insertId, ...data };
  },

  /**
   * Update peer
   */
  async update(id, data) {
    const allowed = ['router_id', 'peer_name', 'public_key', 'wireguard_ip', 'lan_network', 'listen_port', 'status', 'last_handshake'];
    const fields = [];
    const values = [];
    
    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(data[key]);
      }
    }
    
    if (fields.length === 0) return null;
    
    values.push(id);
    const sql = `UPDATE wireguard_peers SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`;
    await query(sql, values);
    
    return this.findById(id);
  },

  /**
   * Delete peer
   */
  async delete(id) {
    const sql = 'DELETE FROM wireguard_peers WHERE id = ?';
    await query(sql, [id]);
  }
};

module.exports = { WireGuardServer, WireGuardPeer };
