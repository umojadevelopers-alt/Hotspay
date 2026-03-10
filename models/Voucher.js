'use strict';

const { query } = require('../config/database');

const Voucher = {
  /**
   * Create a single voucher.
   * @param {Object} data - { username, password, profile_id, router_id, amount, expires_at, customer_id }
   * @returns {Promise<Object>}
   */
  async create(data) {
    const {
      username,
      password,
      profile_id,
      router_id,
      amount = 0,
      expires_at = null,
      customer_id = null,
    } = data;

    const [result] = await query(
      `INSERT INTO vouchers
         (username, password, profile_id, router_id, amount, expires_at, customer_id, is_used, is_expired, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, NOW(), NOW())`,
      [username, password, profile_id, router_id, amount, expires_at, customer_id]
    );

    return this.findById(result.insertId);
  },

  /**
   * Bulk-insert multiple vouchers in a single query for efficiency.
   * @param {Array<Object>} vouchers
   * @returns {Promise<number>} Number of rows inserted
   */
  async createBatch(vouchers) {
    if (!vouchers || vouchers.length === 0) return 0;

    const placeholders = vouchers
      .map(() => '(?, ?, ?, ?, ?, ?, ?, 0, 0, NOW(), NOW())')
      .join(', ');

    const values = vouchers.flatMap((v) => [
      v.username,
      v.password,
      v.profile_id,
      v.router_id,
      v.amount || 0,
      v.expires_at || null,
      v.customer_id || null,
    ]);

    const [result] = await query(
      `INSERT INTO vouchers
         (username, password, profile_id, router_id, amount, expires_at, customer_id, is_used, is_expired, created_at, updated_at)
       VALUES ${placeholders}`,
      values
    );

    return result.affectedRows;
  },

  /**
   * Find a voucher by ID.
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const [rows] = await query(
      `SELECT v.*, p.name AS profile_name, r.name AS router_name
       FROM vouchers v
       LEFT JOIN profiles p ON v.profile_id = p.id
       LEFT JOIN routers r ON v.router_id = r.id
       WHERE v.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Find a voucher by its hotspot username.
   * @param {string} username
   * @returns {Promise<Object|null>}
   */
  async findByUsername(username) {
    const [rows] = await query(
      `SELECT v.*, p.name AS profile_name, r.name AS router_name
       FROM vouchers v
       LEFT JOIN profiles p ON v.profile_id = p.id
       LEFT JOIN routers r ON v.router_id = r.id
       WHERE v.username = ? LIMIT 1`,
      [username]
    );
    return rows[0] || null;
  },

  /**
   * Update a voucher.
   * @param {number} id
   * @param {Object} data
   * @returns {Promise<Object|null>}
   */
  async update(id, data) {
    const allowed = [
      'username', 'password', 'profile_id', 'router_id', 'amount',
      'expires_at', 'customer_id', 'comment', 'is_used', 'is_expired',
    ];
    const keys = Object.keys(data).filter((k) => allowed.includes(k));

    if (keys.length === 0) return this.findById(id);

    const setClauses = keys.map((k) => `${k} = ?`).join(', ');
    const values = keys.map((k) => data[k]);

    await query(
      `UPDATE vouchers SET ${setClauses}, updated_at = NOW() WHERE id = ?`,
      [...values, id]
    );

    return this.findById(id);
  },

  /**
   * Delete a voucher by ID.
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const [result] = await query('DELETE FROM vouchers WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  /**
   * List vouchers with optional filters.
   * @param {Object} [filters] - { is_used, is_expired, profile_id, router_id, limit, offset }
   * @returns {Promise<Array>}
   */
  async list(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.is_used !== undefined) {
      conditions.push('v.is_used = ?');
      params.push(filters.is_used ? 1 : 0);
    }

    if (filters.is_expired !== undefined) {
      conditions.push('v.is_expired = ?');
      params.push(filters.is_expired ? 1 : 0);
    }

    if (filters.profile_id) {
      conditions.push('v.profile_id = ?');
      params.push(filters.profile_id);
    }

    if (filters.router_id) {
      conditions.push('v.router_id = ?');
      params.push(filters.router_id);
    }

    if (filters.customer_id) {
      conditions.push('v.customer_id = ?');
      params.push(filters.customer_id);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = parseInt(filters.limit) || 100;
    const offset = parseInt(filters.offset) || 0;

    const [rows] = await query(
      `SELECT v.*, p.name AS profile_name, r.name AS router_name
       FROM vouchers v
       LEFT JOIN profiles p ON v.profile_id = p.id
       LEFT JOIN routers r ON v.router_id = r.id
       ${where}
       ORDER BY v.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return rows;
  },

  /**
   * Mark a voucher as used, optionally linking it to a customer.
   * @param {number} id
   * @param {number|null} customerId
   * @returns {Promise<Object|null>}
   */
  async markAsUsed(id, customerId = null) {
    await query(
      `UPDATE vouchers
       SET is_used = 1, used_at = NOW(), customer_id = COALESCE(?, customer_id), updated_at = NOW()
       WHERE id = ?`,
      [customerId, id]
    );
    return this.findById(id);
  },

  /**
   * Mark all vouchers whose expiry date has passed as expired.
   * @returns {Promise<number>} Number of updated rows
   */
  async expireOldVouchers() {
    const [result] = await query(
      `UPDATE vouchers
       SET is_expired = 1, updated_at = NOW()
       WHERE is_expired = 0
         AND expires_at IS NOT NULL
         AND expires_at < NOW()`,
      []
    );
    return result.affectedRows;
  },
};

module.exports = Voucher;
