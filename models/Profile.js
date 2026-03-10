'use strict';

const { query } = require('../config/database');

const Profile = {
  /**
   * Create a hotspot profile.
   * @param {Object} data - { name, router_id, display_name, duration, data_limit, speed_up, speed_down, price }
   * @returns {Promise<Object>}
   */
  async create(data) {
    const {
      name,
      router_id,
      display_name = null,
      duration = null,
      data_limit = null,
      speed_up = null,
      speed_down = null,
      price = 0,
    } = data;

    const [result] = await query(
      `INSERT INTO profiles
         (name, router_id, display_name, duration, data_limit, speed_up, speed_down, price, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [name, router_id, display_name, duration, data_limit, speed_up, speed_down, price]
    );

    return this.findById(result.insertId);
  },

  /**
   * Find a profile by ID.
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const [rows] = await query(
      `SELECT p.*, r.name AS router_name
       FROM profiles p
       LEFT JOIN routers r ON p.router_id = r.id
       WHERE p.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Update a profile.
   * @param {number} id
   * @param {Object} data
   * @returns {Promise<Object|null>}
   */
  async update(id, data) {
    const allowed = [
      'name', 'router_id', 'display_name', 'duration',
      'data_limit', 'speed_up', 'speed_down', 'price',
    ];
    const keys = Object.keys(data).filter((k) => allowed.includes(k));

    if (keys.length === 0) return this.findById(id);

    const setClauses = keys.map((k) => `${k} = ?`).join(', ');
    const values = keys.map((k) => data[k]);

    await query(
      `UPDATE profiles SET ${setClauses}, updated_at = NOW() WHERE id = ?`,
      [...values, id]
    );

    return this.findById(id);
  },

  /**
   * Delete a profile by ID.
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const [result] = await query('DELETE FROM profiles WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  /**
   * List all profiles, optionally filtered by router.
   * @param {number|null} [routerId]
   * @returns {Promise<Array>}
   */
  async list(routerId = null) {
    if (routerId) {
      const [rows] = await query(
        `SELECT p.*, r.name AS router_name
         FROM profiles p
         LEFT JOIN routers r ON p.router_id = r.id
         WHERE p.router_id = ?
         ORDER BY p.name ASC`,
        [routerId]
      );
      return rows;
    }

    const [rows] = await query(
      `SELECT p.*, r.name AS router_name
       FROM profiles p
       LEFT JOIN routers r ON p.router_id = r.id
       ORDER BY r.name ASC, p.name ASC`,
      []
    );
    return rows;
  },
};

module.exports = Profile;
