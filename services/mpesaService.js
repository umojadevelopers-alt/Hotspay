'use strict';

const axios = require('axios');

const MPESA_BASE_URL =
  process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

/**
 * Build the Base64-encoded Basic auth credential for OAuth.
 * @returns {string}
 */
function buildBasicAuth() {
  const key = process.env.MPESA_CONSUMER_KEY || '';
  const secret = process.env.MPESA_CONSUMER_SECRET || '';
  return Buffer.from(`${key}:${secret}`).toString('base64');
}

/**
 * Generate the STK-push password (Base64 of shortcode + passkey + timestamp).
 * @param {string} timestamp - YYYYMMDDHHmmss
 * @returns {string}
 */
function buildStkPassword(timestamp) {
  const shortcode = process.env.MPESA_SHORTCODE || '';
  const passkey = process.env.MPESA_PASSKEY || '';
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
}

/**
 * Get a timestamp string in the format YYYYMMDDHHmmss using EAT (UTC+3),
 * which is required by Safaricom Daraja for STK push operations.
 * @returns {string}
 */
function getTimestamp() {
  // EAT is UTC+3; build timestamp from UTC components directly
  const now = new Date();
  const eatMs = now.getTime() + 3 * 60 * 60 * 1000;
  const d = new Date(eatMs);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds())
  );
}

const mpesaService = {
  /**
   * Fetch an M-Pesa OAuth access token from Safaricom Daraja.
   * @returns {Promise<string>} Access token
   */
  async getAccessToken() {
    const response = await axios.get(
      `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${buildBasicAuth()}`,
        },
      }
    );
    return response.data.access_token;
  },

  /**
   * Initiate an M-Pesa STK push (Lipa Na M-Pesa Online).
   * @param {string} phone - Customer phone number in international format (e.g. 254712345678)
   * @param {number} amount - Amount in KES (integer)
   * @param {string} accountRef - Account reference shown on customer's phone
   * @param {string} description - Transaction description
   * @returns {Promise<Object>} Daraja API response
   */
  async stkPush(phone, amount, accountRef, description) {
    const token = await this.getAccessToken();
    const timestamp = getTimestamp();
    const password = buildStkPassword(timestamp);

    const response = await axios.post(
      `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: phone,
        PartyB: process.env.MPESA_SHORTCODE,
        PhoneNumber: phone,
        CallBackURL: process.env.MPESA_CALLBACK_URL,
        AccountReference: accountRef,
        TransactionDesc: description,
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
   * Parse and normalise an M-Pesa STK callback payload.
   * @param {Object} callbackData - Raw callback body from Daraja
   * @returns {Object} Normalised transaction data
   */
  handleCallback(callbackData) {
    const body = callbackData.Body || callbackData;
    const stkCallback = body.stkCallback || body;

    const resultCode = stkCallback.ResultCode;
    const resultDesc = stkCallback.ResultDesc;
    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const merchantRequestId = stkCallback.MerchantRequestID;

    if (resultCode !== 0) {
      return {
        success: false,
        checkoutRequestId,
        merchantRequestId,
        resultCode,
        resultDesc,
      };
    }

    const items = stkCallback.CallbackMetadata
      ? stkCallback.CallbackMetadata.Item
      : [];

    const meta = {};
    for (const item of items) {
      meta[item.Name] = item.Value;
    }

    return {
      success: true,
      checkoutRequestId,
      merchantRequestId,
      resultCode,
      resultDesc,
      amount: meta.Amount,
      mpesaReceiptNumber: meta.MpesaReceiptNumber,
      transactionDate: meta.TransactionDate,
      phoneNumber: meta.PhoneNumber ? String(meta.PhoneNumber) : null,
    };
  },

  /**
   * Query the status of an STK push transaction.
   * @param {string} checkoutRequestId
   * @returns {Promise<Object>}
   */
  async queryTransaction(checkoutRequestId) {
    const token = await this.getAccessToken();
    const timestamp = getTimestamp();
    const password = buildStkPassword(timestamp);

    const response = await axios.post(
      `${MPESA_BASE_URL}/mpesa/stkpushquery/v1/query`,
      {
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
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
};

module.exports = mpesaService;
