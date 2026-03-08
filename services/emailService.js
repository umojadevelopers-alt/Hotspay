'use strict';

const nodemailer = require('nodemailer');

/** Lazily created transporter instance. */
let _transporter = null;

function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASSWORD || '',
      },
    });
  }
  return _transporter;
}

/** Sender display name + address used for all outgoing mail. */
function from() {
  const name = process.env.SMTP_FROM_NAME || process.env.APP_NAME || 'Hotspay';
  const email = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@hotspay.com';
  return `"${name}" <${email}>`;
}

const emailService = {
  /**
   * Send a generic HTML email.
   * @param {string} to - Recipient email address
   * @param {string} subject
   * @param {string} html - HTML body
   * @returns {Promise<Object>} Nodemailer info object
   */
  async sendEmail(to, subject, html) {
    if (process.env.EMAIL_ENABLED !== 'true') {
      console.log(`[Email disabled] To: ${to} | Subject: ${subject}`);
      return { status: 'disabled' };
    }

    const transporter = getTransporter();
    return transporter.sendMail({ from: from(), to, subject, html });
  },

  /**
   * Send a payment receipt to a customer.
   * @param {string} email
   * @param {Object} transaction - Transaction DB record
   * @param {Object} [voucher] - Associated voucher (optional)
   * @returns {Promise<Object>}
   */
  async sendReceipt(email, transaction, voucher) {
    const appName = process.env.APP_NAME || 'Hotspay';
    const subject = `${appName} – Payment Receipt #${transaction.receipt_number}`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
        <div style="background:#2563eb;color:#fff;padding:20px 30px">
          <h2 style="margin:0">${appName} – Payment Receipt</h2>
        </div>
        <div style="padding:30px">
          <p>Thank you for your payment.</p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
            <tr><td style="padding:8px;border-bottom:1px solid #f0f0f0;color:#666">Receipt No.</td>
                <td style="padding:8px;border-bottom:1px solid #f0f0f0;font-weight:bold">${transaction.receipt_number}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #f0f0f0;color:#666">Amount</td>
                <td style="padding:8px;border-bottom:1px solid #f0f0f0">${Number(transaction.amount).toFixed(2)}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #f0f0f0;color:#666">Payment Method</td>
                <td style="padding:8px;border-bottom:1px solid #f0f0f0">${transaction.payment_method}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #f0f0f0;color:#666">Status</td>
                <td style="padding:8px;border-bottom:1px solid #f0f0f0">${transaction.status}</td></tr>
            <tr><td style="padding:8px;color:#666">Date</td>
                <td style="padding:8px">${new Date(transaction.created_at).toLocaleString()}</td></tr>
          </table>
          ${voucher ? `
          <div style="background:#f8f8f8;border-radius:6px;padding:20px;text-align:center">
            <h3 style="margin-top:0">Your Wi-Fi Voucher</h3>
            <p style="font-size:18px;font-weight:bold;letter-spacing:2px">${voucher.username} / ${voucher.password}</p>
            ${voucher.profile_name ? `<p>Plan: ${voucher.profile_name}</p>` : ''}
          </div>` : ''}
          <p style="margin-top:30px;color:#888;font-size:12px">
            This is an automated receipt from ${appName}. Please keep it for your records.
          </p>
        </div>
      </div>`;

    return this.sendEmail(email, subject, html);
  },

  /**
   * Send voucher credentials to a customer.
   * @param {string} email
   * @param {Object} voucher - Voucher DB record
   * @returns {Promise<Object>}
   */
  async sendVoucherEmail(email, voucher) {
    const appName = process.env.APP_NAME || 'Hotspay';
    const subject = `${appName} – Your Wi-Fi Voucher`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
        <div style="background:#2563eb;color:#fff;padding:20px 30px">
          <h2 style="margin:0">${appName} – Wi-Fi Voucher</h2>
        </div>
        <div style="padding:30px;text-align:center">
          <p>Here are your Wi-Fi credentials:</p>
          <div style="background:#f8f8f8;border-radius:6px;padding:24px;display:inline-block">
            <p style="margin:0;color:#555">Username</p>
            <p style="font-size:22px;font-weight:bold;letter-spacing:3px;margin:4px 0 16px">${voucher.username}</p>
            <p style="margin:0;color:#555">Password</p>
            <p style="font-size:22px;font-weight:bold;letter-spacing:3px;margin:4px 0">${voucher.password}</p>
          </div>
          ${voucher.profile_name ? `<p style="margin-top:16px">Plan: <strong>${voucher.profile_name}</strong></p>` : ''}
          <p style="margin-top:30px;color:#888;font-size:12px">Powered by ${appName}</p>
        </div>
      </div>`;

    return this.sendEmail(email, subject, html);
  },

  /**
   * Send a voucher expiry alert.
   * @param {string} email
   * @param {string} username
   * @param {Date|string} expiresAt
   * @returns {Promise<Object>}
   */
  async sendExpiryAlert(email, username, expiresAt) {
    const appName = process.env.APP_NAME || 'Hotspay';
    const expiry = new Date(expiresAt).toLocaleString();
    const subject = `${appName} – Voucher Expiry Notice`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2>${appName} – Voucher Expiry Notice</h2>
        <p>Your voucher <strong>${username}</strong> will expire on <strong>${expiry}</strong>.</p>
        <p>Please renew your voucher to continue enjoying uninterrupted Wi-Fi access.</p>
        <p style="color:#888;font-size:12px">Powered by ${appName}</p>
      </div>`;

    return this.sendEmail(email, subject, html);
  },
};

module.exports = emailService;
