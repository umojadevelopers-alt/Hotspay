'use strict';

const AfricasTalking = require('africastalking');

/** Lazily initialised Africa's Talking client. */
let _client = null;
let _sms = null;

function getClient() {
  if (!_client) {
    _client = AfricasTalking({
      apiKey: process.env.AT_API_KEY || '',
      username: process.env.AT_USERNAME || 'sandbox',
    });
    _sms = _client.SMS;
  }
  return _sms;
}

const smsService = {
  /**
   * Send a plain SMS message to a single recipient.
   * @param {string} to - Phone number in international format (e.g. +254712345678)
   * @param {string} message - Message body
   * @returns {Promise<Object>} Africa's Talking API response
   */
  async sendSMS(to, message) {
    if (process.env.SMS_ENABLED !== 'true') {
      console.log(`[SMS disabled] To: ${to} | Message: ${message}`);
      return { status: 'disabled' };
    }

    const sms = getClient();
    const options = {
      to: [to],
      message,
    };

    if (process.env.AT_SENDER_ID) {
      options.from = process.env.AT_SENDER_ID;
    }

    return sms.send(options);
  },

  /**
   * Send voucher credentials to a customer via SMS.
   * @param {string} phone
   * @param {Object} voucher - Voucher DB record
   * @returns {Promise<Object>}
   */
  async sendVoucherSMS(phone, voucher) {
    const message =
      `Your ${process.env.APP_NAME || 'Hotspay'} Wi-Fi voucher:\n` +
      `Username: ${voucher.username}\n` +
      `Password: ${voucher.password}\n` +
      (voucher.profile_name ? `Plan: ${voucher.profile_name}\n` : '') +
      `Enjoy browsing!`;

    return this.sendSMS(phone, message);
  },

  /**
   * Send a voucher expiry warning to a customer.
   * @param {string} phone
   * @param {string} username
   * @param {Date|string} expiresAt
   * @returns {Promise<Object>}
   */
  async sendExpiryAlert(phone, username, expiresAt) {
    const expiry = new Date(expiresAt).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });
    const message =
      `Hi, your ${process.env.APP_NAME || 'Hotspay'} voucher (${username}) ` +
      `will expire on ${expiry}. Renew to keep browsing.`;

    return this.sendSMS(phone, message);
  },

  /**
   * Send a login notification to a customer.
   * @param {string} phone
   * @param {string} username
   * @param {Object} sessionInfo - { ip, mac, loginAt }
   * @returns {Promise<Object>}
   */
  async sendLoginAlert(phone, username, sessionInfo) {
    const loginTime = sessionInfo.loginAt
      ? new Date(sessionInfo.loginAt).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })
      : new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });

    const message =
      `${process.env.APP_NAME || 'Hotspay'}: Login detected for ${username} at ${loginTime}.` +
      (sessionInfo.ip ? ` IP: ${sessionInfo.ip}.` : '') +
      ` If this wasn't you, contact support.`;

    return this.sendSMS(phone, message);
  },
};

module.exports = smsService;
