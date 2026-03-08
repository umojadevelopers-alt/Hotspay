'use strict';

const { query } = require('../config/database');

const Customer = {
  /**
   * Create a new customer.
   * @param {Object} data - { name, phone, email, address, notes }
   * @returns {Promise<Object>}
   */
  async create(data) {
    const { name, phone, email = null, address = null, notes = null } = data;

    const [result] = await query(
      `INSERT INTO customers (name, phone, email, address, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [name, phone, email, address, notes]
    );

    return this.findById(result.insertId);
  },

  /**
   * Find a customer by ID.
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const [rows] = await query(
      'SELECT * FROM customers WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Update a customer.
   * @param {number} id
   * @param {Object} data
   * @returns {Promise<Object|null>}
   */
  async update(id, data) {
    const allowed = ['name', 'phone', 'email', 'address', 'notes', 'is_active'];
    const keys = Object.keys(data).filter((k) => allowed.includes(k));

    if (keys.length === 0) return this.findById(id);

    const setClauses = keys.map((k) => `${k} = ?`).join(', ');
    const values = keys.map((k) => data[k]);

    await query(
      `UPDATE customers SET ${setClauses}, updated_at = NOW() WHERE id = ?`,
      [...values, id]
    );

    return this.findById(id);
  },

  /**
   * Delete a customer by ID.
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const [result] = await query('DELETE FROM customers WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  /**
   * List customers with optional search and pagination.
   * @param {Object} [filters] - { search, is_active, limit, offset }
   * @returns {Promise<Array>}
   */
  async list(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.is_active !== undefined) {
      conditions.push('is_active = ?');
      params.push(filters.is_active ? 1 : 0);
    }

    if (filters.search) {
      conditions.push('(name LIKE ? OR phone LIKE ? OR email LIKE ?)');
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = parseInt(filters.limit) || 100;
    const offset = parseInt(filters.offset) || 0;

    const [rows] = await query(
      `SELECT * FROM customers ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return rows;
  },

  /**
   * Get a customer's hotspot session history from session_logs.
   * @param {number} customerId
   * @returns {Promise<Array>}
   */
  async getSessionHistory(customerId) {
    const [rows] = await query(
      `SELECT sl.*, v.username, v.profile_id, p.name AS profile_name
       FROM session_logs sl
       LEFT JOIN vouchers v ON sl.voucher_id = v.id
       LEFT JOIN profiles p ON v.profile_id = p.id
       WHERE sl.customer_id = ?
       ORDER BY sl.login_at DESC`,
      [customerId]
    );
    return rows;
  },
};

module.exports = Customer;
