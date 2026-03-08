'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const smsService = require('../services/smsService');
const Voucher = require('../models/Voucher');
const Customer = require('../models/Customer');

// POST /api/sms/send - super_admin only
router.post('/send', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ success: false, message: 'phone and message are required' });
    }

    const result = await smsService.sendSMS(phone, message);
    return res.json({ success: true, message: 'SMS sent', data: { result } });
  } catch (err) {
    console.error('[sms POST /send]', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

// POST /api/sms/voucher/:voucherId - send voucher via SMS
router.post('/voucher/:voucherId', authenticate, requireRole('cashier'), async (req, res) => {
  try {
    const voucherId = parseInt(req.params.voucherId);
    if (!voucherId) return res.status(400).json({ success: false, message: 'Invalid voucher ID' });

    const voucher = await Voucher.findById(voucherId);
    if (!voucher) return res.status(404).json({ success: false, message: 'Voucher not found' });

    // Determine recipient phone: from request body, or customer linked to voucher
    let phone = req.body.phone;
    if (!phone && voucher.customer_id) {
      const customer = await Customer.findById(voucher.customer_id);
      if (customer) phone = customer.phone;
    }

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'phone is required (or link the voucher to a customer with a phone number)',
      });
    }

    const result = await smsService.sendVoucherSMS(phone, voucher);
    return res.json({ success: true, message: 'Voucher SMS sent', data: { result } });
  } catch (err) {
    console.error('[sms POST /voucher/:voucherId]', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

// POST /api/sms/bulk - super_admin only
router.post('/bulk', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const { recipients, message } = req.body;
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ success: false, message: 'recipients (array) and message are required' });
    }
    if (!message) {
      return res.status(400).json({ success: false, message: 'message is required' });
    }

    const results = [];
    const errors = [];

    for (const phone of recipients) {
      try {
        const result = await smsService.sendSMS(phone, message);
        results.push({ phone, result });
      } catch (smsErr) {
        errors.push({ phone, error: smsErr.message });
      }
    }

    return res.json({
      success: true,
      message: `Bulk SMS sent: ${results.length} succeeded, ${errors.length} failed`,
      data: { sent: results.length, failed: errors.length, results, errors },
    });
  } catch (err) {
    console.error('[sms POST /bulk]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
