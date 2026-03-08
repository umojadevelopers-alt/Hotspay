'use strict';

const axios = require('axios');

const PAYPAL_BASE_URL =
  process.env.PAYPAL_ENV === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

/**
 * Build Basic auth header from PayPal client credentials.
 * @returns {string}
 */
function buildBasicAuth() {
  const clientId = process.env.PAYPAL_CLIENT_ID || '';
  const secret = process.env.PAYPAL_CLIENT_SECRET || '';
  return Buffer.from(`${clientId}:${secret}`).toString('base64');
}

const paypalService = {
  /**
   * Obtain a PayPal OAuth2 access token (client_credentials grant).
   * @returns {Promise<string>} Bearer access token
   */
  async getAccessToken() {
    const response = await axios.post(
      `${PAYPAL_BASE_URL}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${buildBasicAuth()}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    return response.data.access_token;
  },

  /**
   * Create a PayPal order (CAPTURE intent).
   * @param {number} amount - Amount as a number (e.g. 10.00)
   * @param {string} [currency='USD'] - ISO currency code
   * @param {string} [description=''] - Item description
   * @returns {Promise<Object>} PayPal order object (contains id and approval link)
   */
  async createOrder(amount, currency = 'USD', description = '') {
    const token = await this.getAccessToken();

    const response = await axios.post(
      `${PAYPAL_BASE_URL}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: Number(amount).toFixed(2),
            },
            description,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  },

  /**
   * Capture an approved PayPal order.
   * @param {string} orderId - PayPal order ID returned from createOrder
   * @returns {Promise<Object>} Capture result
   */
  async captureOrder(orderId) {
    const token = await this.getAccessToken();

    const response = await axios.post(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  },

  /**
   * Retrieve details of a PayPal order.
   * @param {string} orderId
   * @returns {Promise<Object>} PayPal order details
   */
  async getOrderDetails(orderId) {
    const token = await this.getAccessToken();

    const response = await axios.get(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  },
};

module.exports = paypalService;
