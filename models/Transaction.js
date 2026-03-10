'use strict';

const { query } = require('../config/database');

/**
 * Generate a receipt number: RCP-YYYYMMDD-RANDOM6.
 * @returns {string}
 */
function generateReceiptNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `RCP-${date}-${rand}`;
}

const Transaction = {
  /**
   * Create a transaction. A unique receipt_number is auto-generated.
   * @param {Object} data - { customer_id, voucher_id, amount, payment_method, payment_reference, status, notes }
   * @returns {Promise<Object>}
   */
  async create(data) {
    const {
      customer_id = null,
      voucher_id = null,
      amount,
      payment_method,
      payment_reference = null,
      status = 'pending',
      notes = null,
    } = data;

    const receipt_number = generateReceiptNumber();

    const [result] = await query(
      `INSERT INTO transactions
         (receipt_number, customer_id, voucher_id, amount, payment_method, payment_reference, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [receipt_number, customer_id, voucher_id, amount, payment_method, payment_reference, status, notes]
    );

    return this.findById(result.insertId);
  },

  /**
   * Find a transaction by ID.
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const [rows] = await query(
      `SELECT t.*, c.name AS customer_name, c.phone AS customer_phone
       FROM transactions t
       LEFT JOIN customers c ON t.customer_id = c.id
       WHERE t.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Find a transaction by payment reference (e.g. M-Pesa CheckoutRequestID).
   * @param {string} reference
   * @returns {Promise<Object|null>}
   */
  async findByReference(reference) {
    const [rows] = await query(
      `SELECT t.*, c.name AS customer_name, c.phone AS customer_phone
       FROM transactions t
       LEFT JOIN customers c ON t.customer_id = c.id
       WHERE t.payment_reference = ? LIMIT 1`,
      [reference]
    );
    return rows[0] || null;
  },

  /**
   * Update a transaction.
   * @param {number} id
   * @param {Object} data
   * @returns {Promise<Object|null>}
   */
  async update(id, data) {
    const allowed = [
      'customer_id', 'voucher_id', 'amount', 'payment_method',
      'payment_reference', 'status', 'notes',
    ];
    const keys = Object.keys(data).filter((k) => allowed.includes(k));

    if (keys.length === 0) return this.findById(id);

    const setClauses = keys.map((k) => `${k} = ?`).join(', ');
    const values = keys.map((k) => data[k]);

    await query(
      `UPDATE transactions SET ${setClauses}, updated_at = NOW() WHERE id = ?`,
      [...values, id]
    );

    return this.findById(id);
  },

  /**
   * List transactions with optional filters.
   * @param {Object} [filters] - { customer_id, payment_method, status, from_date, to_date, limit, offset }
   * @returns {Promise<Array>}
   */
  async list(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.customer_id) {
      conditions.push('t.customer_id = ?');
      params.push(filters.customer_id);
    }

    if (filters.payment_method) {
      conditions.push('t.payment_method = ?');
      params.push(filters.payment_method);
    }

    if (filters.status) {
      conditions.push('t.status = ?');
      params.push(filters.status);
    }

    if (filters.from_date) {
      conditions.push('DATE(t.created_at) >= ?');
      params.push(filters.from_date);
    }

    if (filters.to_date) {
      conditions.push('DATE(t.created_at) <= ?');
      params.push(filters.to_date);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = parseInt(filters.limit) || 100;
    const offset = parseInt(filters.offset) || 0;

    const [rows] = await query(
      `SELECT t.*, c.name AS customer_name, c.phone AS customer_phone FROM transactions t LEFT JOIN customers c ON t.customer_id = c.id ${where} ORDER BY t.created_at DESC LIMIT ${offset}, ${limit}`,
      params
    );

    return rows;
  },

  /**
   * Get total revenue for a specific date (completed transactions only).
   * @param {string} date - YYYY-MM-DD
   * @returns {Promise<Object>} { date, total, count }
   */
  async getDailySummary(date) {
    const [rows] = await query(
      `SELECT
         DATE(created_at) AS date,
         SUM(amount)      AS total,
         COUNT(*)         AS count
       FROM transactions
       WHERE DATE(created_at) = ?
         AND status = 'completed'
       GROUP BY DATE(created_at)`,
      [date]
    );
    return rows[0] || { date, total: 0, count: 0 };
  },

  /**
   * Get monthly revenue breakdown (per day) for completed transactions.
   * @param {number} year
   * @param {number} month - 1-12
   * @returns {Promise<Array>} Array of { date, total, count }
   */
  async getMonthlySummary(year, month) {
    const [rows] = await query(
      `SELECT
         DATE(created_at) AS date,
         SUM(amount)      AS total,
         COUNT(*)         AS count
       FROM transactions
       WHERE YEAR(created_at)  = ?
         AND MONTH(created_at) = ?
         AND status = 'completed'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [year, month]
    );
    return rows;
  },
};

module.exports = Transaction;
