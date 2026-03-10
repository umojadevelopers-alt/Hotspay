'use strict';

const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

const User = {
  /**
   * Find an admin user by email.
   * @param {string} email
   * @returns {Promise<Object|null>}
   */
  async findByEmail(email) {
    const [rows] = await query(
      'SELECT * FROM admin_users WHERE email = ? LIMIT 1',
      [email]
    );
    return rows[0] || null;
  },

  /**
   * Find an admin user by ID.
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const [rows] = await query(
      'SELECT * FROM admin_users WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Create a new admin user. Password is hashed before storage.
   * @param {Object} data - { name, email, password, role }
   * @returns {Promise<Object>} Created user (without password)
   */
  async create(data) {
    const { name, email, password, role = 'admin' } = data;

    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const [result] = await query(
      'INSERT INTO admin_users (name, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
      [name, email, hashed, role]
    );

    return this.findById(result.insertId);
  },

  /**
   * Update a user record. If password is provided it will be re-hashed.
   * @param {number} id
   * @param {Object} data
   * @returns {Promise<Object|null>}
   */
  async update(id, data) {
    const fields = { ...data };

    if (fields.password) {
      fields.password = await bcrypt.hash(fields.password, BCRYPT_ROUNDS);
    }

    const keys = Object.keys(fields).filter(
      (k) => ['name', 'email', 'password', 'role', 'is_active'].includes(k)
    );

    if (keys.length === 0) return this.findById(id);

    const setClauses = keys.map((k) => `${k} = ?`).join(', ');
    const values = keys.map((k) => fields[k]);

    await query(
      `UPDATE admin_users SET ${setClauses}, updated_at = NOW() WHERE id = ?`,
      [...values, id]
    );

    return this.findById(id);
  },

  /**
   * Delete a user by ID.
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const [result] = await query('DELETE FROM admin_users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  /**
   * List all users with optional filters.
   * @param {Object} [filters] - { role, is_active, search }
   * @returns {Promise<Array>}
   */
  async list(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.role) {
      conditions.push('role = ?');
      params.push(filters.role);
    }

    if (filters.is_active !== undefined) {
      conditions.push('is_active = ?');
      params.push(filters.is_active ? 1 : 0);
    }

    if (filters.search) {
      conditions.push('(name LIKE ? OR email LIKE ?)');
      const term = `%${filters.search}%`;
      params.push(term, term);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await query(
      `SELECT id, name, email, role, is_active, created_at, updated_at FROM admin_users ${where} ORDER BY created_at DESC`,
      params
    );

    return rows;
  },

  /**
   * Compare a plaintext password against a stored bcrypt hash.
   * @param {string} plaintext
   * @param {string} hash
   * @returns {Promise<boolean>}
   */
  async comparePassword(plaintext, hash) {
    return bcrypt.compare(plaintext, hash);
  },
};

module.exports = User;
