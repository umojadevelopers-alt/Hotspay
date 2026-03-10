'use strict';

const { query } = require('../config/database');

/**
 * Encode a string using Base64.
 * NOTE: Base64 is NOT encryption – replace with AES (e.g. crypto module) in production.
 * @param {string} text
 * @returns {string}
 */
function encode(text) {
  return Buffer.from(text, 'utf8').toString('base64');
}

/**
 * Decode a Base64-encoded string.
 * @param {string} encoded
 * @returns {string}
 */
function decode(encoded) {
  return Buffer.from(encoded, 'base64').toString('utf8');
}

const Router = {
  /**
   * Create a new router record.
   * The api_password is Base64-encoded before storage.
   * @param {Object} data - { name, host, api_port, api_user, api_password, is_active }
   * @returns {Promise<Object>}
   */
  async create(data) {
    const {
      name,
      host,
      api_port = 8728,
      api_user,
      api_password,
      is_active = true,
    } = data;

    const encodedPassword = encode(api_password);

    const [result] = await query(
      `INSERT INTO routers
         (name, host, api_port, api_user, api_password, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [name, host, api_port, api_user, encodedPassword, is_active ? 1 : 0]
    );

    return this.findById(result.insertId);
  },

  /**
   * Find a router by ID. The api_password is decoded before returning.
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const [rows] = await query(
      'SELECT * FROM routers WHERE id = ? LIMIT 1',
      [id]
    );

    if (!rows[0]) return null;

    return this.getDecryptedPassword(rows[0]);
  },

  /**
   * Update a router record.
   * @param {number} id
   * @param {Object} data
   * @returns {Promise<Object|null>}
   */
  async update(id, data) {
    const fields = { ...data };

    if (fields.api_password) {
      fields.api_password = encode(fields.api_password);
    }

    const allowed = ['name', 'host', 'api_port', 'api_user', 'api_password', 'is_active'];
    const keys = Object.keys(fields).filter((k) => allowed.includes(k));

    if (keys.length === 0) return this.findById(id);

    const setClauses = keys.map((k) => `${k} = ?`).join(', ');
    const values = keys.map((k) => fields[k]);

    await query(
      `UPDATE routers SET ${setClauses}, updated_at = NOW() WHERE id = ?`,
      [...values, id]
    );

    return this.findById(id);
  },

  /**
   * Soft-delete a router by setting is_active = false.
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const [result] = await query(
      'UPDATE routers SET is_active = 0, updated_at = NOW() WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  },

  /**
   * List all active routers (with decoded passwords).
   * @returns {Promise<Array>}
   */
  async list() {
    const [rows] = await query(
      'SELECT * FROM routers WHERE is_active = 1 ORDER BY name ASC',
      []
    );

    return rows.map((r) => this.getDecryptedPassword(r));
  },

  /**
   * Decode the api_password field of a router object.
   * @param {Object} router
   * @returns {Object} Router with plaintext api_password
   */
  getDecryptedPassword(router) {
    if (!router) return null;

    try {
      return {
        ...router,
        api_password: decode(router.api_password),
      };
    } catch {
      // If decoding fails, return as-is (legacy plaintext)
      return router;
    }
  },
};

module.exports = Router;
