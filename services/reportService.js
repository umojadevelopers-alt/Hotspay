'use strict';

const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { query } = require('../config/database');

const reportService = {
  /**
   * Aggregate dashboard statistics.
   * @returns {Promise<Object>} { totalUsers, totalRevenue, activeVouchers, vouchersSold, ... }
   */
  async getDashboardStats() {
    const [[customerRows]] = await query('SELECT COUNT(*) AS total FROM customers', []);
    const [[revenueRows]] = await query(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE status = 'completed'",
      []
    );
    const [[activeVoucherRows]] = await query(
      'SELECT COUNT(*) AS total FROM vouchers WHERE is_used = 0 AND is_expired = 0',
      []
    );
    const [[soldVoucherRows]] = await query(
      'SELECT COUNT(*) AS total FROM vouchers WHERE is_used = 1',
      []
    );
    const [[routerRows]] = await query(
      'SELECT COUNT(*) AS total FROM routers WHERE is_active = 1',
      []
    );
    const [[todayRevenueRows]] = await query(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE status = 'completed' AND DATE(created_at) = CURDATE()",
      []
    );

    return {
      totalCustomers: customerRows.total,
      totalRevenue: Number(revenueRows.total),
      todayRevenue: Number(todayRevenueRows.total),
      activeVouchers: activeVoucherRows.total,
      vouchersSold: soldVoucherRows.total,
      activeRouters: routerRows.total,
    };
  },

  /**
   * Get revenue data grouped by period or custom date range.
   * @param {'daily'|'weekly'|'monthly'} period
   * @param {string} [from] - Start date (YYYY-MM-DD), overrides period default range
   * @param {string} [to] - End date (YYYY-MM-DD), overrides period default range
   * @returns {Promise<Array>} Array of { label, total, count }
   */
  async getRevenueChart(period = 'daily', from = null, to = null) {
    let sql;
    const params = [];

    if (from && to) {
      // Custom date range — always return daily grouping
      sql = `
        SELECT DATE(created_at)  AS label,
               DATE(created_at)  AS date,
               SUM(amount)       AS total,
               COUNT(*)          AS count
        FROM transactions
        WHERE status = 'completed'
          AND DATE(created_at) BETWEEN ? AND ?
        GROUP BY label
        ORDER BY label ASC`;
      params.push(from, to);
    } else if (period === 'monthly') {
      sql = `
        SELECT DATE_FORMAT(created_at, '%Y-%m') AS label,
               SUM(amount)                       AS total,
               COUNT(*)                          AS count
        FROM transactions
        WHERE status = 'completed'
          AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        GROUP BY label
        ORDER BY label ASC`;
    } else if (period === 'weekly') {
      sql = `
        SELECT DATE_FORMAT(created_at, '%x-W%v') AS label,
               SUM(amount)                        AS total,
               COUNT(*)                           AS count
        FROM transactions
        WHERE status = 'completed'
          AND created_at >= DATE_SUB(NOW(), INTERVAL 12 WEEK)
        GROUP BY label
        ORDER BY label ASC`;
    } else {
      // daily — last 30 days
      sql = `
        SELECT DATE(created_at)  AS label,
               DATE(created_at)  AS date,
               SUM(amount)       AS total,
               COUNT(*)          AS count
        FROM transactions
        WHERE status = 'completed'
          AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY label
        ORDER BY label ASC`;
    }

    const [rows] = await query(sql, params);
    return rows;
  },

  /**
   * Get new customers/users per day grouped by period.
   * @param {'daily'|'weekly'|'monthly'} period
   * @returns {Promise<Array>} Array of { label, count }
   */
  async getUsersChart(period = 'daily') {
    let sql;

    if (period === 'monthly') {
      sql = `
        SELECT DATE_FORMAT(created_at, '%Y-%m') AS label, COUNT(*) AS count
        FROM customers
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        GROUP BY label
        ORDER BY label ASC`;
    } else if (period === 'weekly') {
      sql = `
        SELECT DATE_FORMAT(created_at, '%x-W%v') AS label, COUNT(*) AS count
        FROM customers
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 WEEK)
        GROUP BY label
        ORDER BY label ASC`;
    } else {
      sql = `
        SELECT DATE(created_at) AS label, COUNT(*) AS count
        FROM customers
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY label
        ORDER BY label ASC`;
    }

    const [rows] = await query(sql, []);
    return rows;
  },

  /**
   * Generate a PDF report from tabular data.
   * @param {Array<Object>} data - Array of row objects
   * @param {string} [title='Report'] - Report heading
   * @returns {Promise<Buffer>} PDF buffer
   */
  async generatePDFReport(data, title = 'Report') {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const appName = process.env.APP_NAME || 'Hotspay';

      // Header
      doc
        .fontSize(18)
        .fillColor('#2563eb')
        .font('Helvetica-Bold')
        .text(appName, { align: 'center' });
      doc.fontSize(13).fillColor('#333').font('Helvetica-Bold').text(title, { align: 'center' });
      doc.fontSize(9).fillColor('#888').font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(1);

      if (!data || data.length === 0) {
        doc.fontSize(11).fillColor('#555').text('No data available.');
        doc.end();
        return;
      }

      const columns = Object.keys(data[0]);
      const colWidth = (doc.page.width - 80) / columns.length;

      // Table header
      const headerY = doc.y;
      doc.rect(40, headerY, doc.page.width - 80, 18).fill('#2563eb');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      columns.forEach((col, i) => {
        doc.text(col, 40 + i * colWidth, headerY + 5, { width: colWidth - 4, ellipsis: true });
      });
      doc.moveDown(0.5);

      // Table rows
      data.forEach((row, rowIdx) => {
        if (doc.y > doc.page.height - 80) {
          doc.addPage();
        }

        const rowY = doc.y;
        const bgColor = rowIdx % 2 === 0 ? '#f8f9fa' : '#ffffff';
        doc.rect(40, rowY, doc.page.width - 80, 16).fill(bgColor);
        doc.fillColor('#333333').fontSize(7.5).font('Helvetica');

        columns.forEach((col, i) => {
          const val = row[col] !== null && row[col] !== undefined ? String(row[col]) : '';
          doc.text(val, 40 + i * colWidth, rowY + 4, { width: colWidth - 4, ellipsis: true });
        });

        doc.moveDown(0.4);
      });

      doc.end();
    });
  },

  /**
   * Generate an Excel (.xlsx) report from tabular data.
   * @param {Array<Object>} data
   * @param {string} [title='Report']
   * @returns {Promise<Buffer>} Excel buffer
   */
  async generateExcelReport(data, title = 'Report') {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = process.env.APP_NAME || 'Hotspay';
    workbook.created = new Date();

    const ts = String(Date.now()); // 13 digits
    const maxTitleLen = 31 - 1 - ts.length; // reserve 1 for '-' separator
    const sheetName = `${title.substring(0, maxTitleLen)}-${ts}`;
    const sheet = workbook.addWorksheet(sheetName);

    if (!data || data.length === 0) {
      sheet.addRow(['No data available']);
      return workbook.xlsx.writeBuffer();
    }

    const columns = Object.keys(data[0]);

    // Header row
    sheet.addRow(columns);
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };

    // Auto-size columns
    sheet.columns = columns.map((col) => ({
      header: col,
      key: col,
      width: Math.max(col.length + 4, 14),
    }));

    // Data rows
    data.forEach((row) => {
      sheet.addRow(columns.map((col) => row[col] !== undefined ? row[col] : ''));
    });

    return workbook.xlsx.writeBuffer();
  },

  /**
   * Convert an array of objects to a CSV string.
   * @param {Array<Object>} data
   * @returns {string} CSV content
   */
  generateCSVReport(data) {
    if (!data || data.length === 0) return '';

    const columns = Object.keys(data[0]);

    const escape = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      // Wrap in quotes if the value contains comma, quote, or newline
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = columns.map(escape).join(',');
    const rows = data.map((row) => columns.map((col) => escape(row[col])).join(','));

    return [header, ...rows].join('\n');
  },

  /**
   * Get session logs with optional filters.
   * @param {Object} [filters] - { customer_id, voucher_id, from_date, to_date, router_id, limit, offset }
   * @returns {Promise<Array>}
   */
  async getSessionHistory(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.customer_id) {
      conditions.push('sl.customer_id = ?');
      params.push(filters.customer_id);
    }

    if (filters.voucher_id) {
      conditions.push('sl.voucher_id = ?');
      params.push(filters.voucher_id);
    }

    if (filters.router_id) {
      conditions.push('v.router_id = ?');
      params.push(filters.router_id);
    }

    if (filters.from_date) {
      conditions.push('DATE(sl.login_at) >= ?');
      params.push(filters.from_date);
    }

    if (filters.to_date) {
      conditions.push('DATE(sl.login_at) <= ?');
      params.push(filters.to_date);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = parseInt(filters.limit) || 100;
    const offset = parseInt(filters.offset) || 0;

    const [rows] = await query(
      `SELECT sl.*,
              c.name  AS customer_name,
              c.phone AS customer_phone,
              v.username,
              r.name  AS router_name
       FROM session_logs sl
       LEFT JOIN customers c ON sl.customer_id = c.id
       LEFT JOIN vouchers  v ON sl.voucher_id  = v.id
       LEFT JOIN routers   r ON v.router_id    = r.id
       ${where}
       ORDER BY sl.login_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return rows;
  },

  /**
   * Get bandwidth usage aggregated per voucher/user.
   * @param {Object} [filters] - { router_id, from_date, to_date, limit, offset }
   * @returns {Promise<Array>}
   */
  async getBandwidthUsage(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.router_id) {
      conditions.push('v.router_id = ?');
      params.push(filters.router_id);
    }

    if (filters.from_date) {
      conditions.push('DATE(sl.login_at) >= ?');
      params.push(filters.from_date);
    }

    if (filters.to_date) {
      conditions.push('DATE(sl.login_at) <= ?');
      params.push(filters.to_date);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = parseInt(filters.limit) || 100;
    const offset = parseInt(filters.offset) || 0;

    const [rows] = await query(
      `SELECT v.username,
              c.name        AS customer_name,
              r.name        AS router_name,
              COUNT(sl.id)  AS session_count,
              SUM(sl.bytes_in)  AS total_bytes_in,
              SUM(sl.bytes_out) AS total_bytes_out,
              SUM(sl.bytes_in + sl.bytes_out) AS total_bytes
       FROM session_logs sl
       LEFT JOIN vouchers  v ON sl.voucher_id  = v.id
       LEFT JOIN customers c ON sl.customer_id = c.id
       LEFT JOIN routers   r ON v.router_id    = r.id
       ${where}
       GROUP BY v.id, v.username, c.name, r.name
       ORDER BY total_bytes DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return rows;
  },
};

module.exports = reportService;
