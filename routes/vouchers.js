'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const Voucher = require('../models/Voucher');
const voucherService = require('../services/voucherService');
const mikrotikService = require('../services/mikrotikService');

// GET /api/vouchers - NOTE: specific routes (/pdf, /sync) must be declared before /:id
router.get('/', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const { is_used, is_expired, profile_id, router_id, limit, offset } = req.query;
    const filters = {};
    if (is_used !== undefined) filters.is_used = is_used === 'true' || is_used === '1';
    if (is_expired !== undefined) filters.is_expired = is_expired === 'true' || is_expired === '1';
    if (profile_id) filters.profile_id = parseInt(profile_id);
    if (router_id) filters.router_id = parseInt(router_id);
    if (limit) filters.limit = parseInt(limit);
    if (offset) filters.offset = parseInt(offset);

    const vouchers = await Voucher.list(filters);
    return res.json({ success: true, message: 'Vouchers retrieved', data: { vouchers } });
  } catch (err) {
    console.error('[vouchers GET /]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/vouchers/generate
router.post('/generate', authenticate, requireRole('cashier'), async (req, res) => {
  try {
    const { count, profile_id, router_id, amount } = req.body;
    if (!count || !profile_id || !router_id) {
      return res.status(400).json({ success: false, message: 'count, profile_id, and router_id are required' });
    }

    const parsedCount = parseInt(count);
    if (isNaN(parsedCount) || parsedCount < 1 || parsedCount > 1000) {
      return res.status(400).json({ success: false, message: 'count must be between 1 and 1000' });
    }

    const vouchers = await voucherService.generateVouchers(
      parsedCount,
      parseInt(profile_id),
      parseInt(router_id),
      parseFloat(amount) || 0
    );

    return res.status(201).json({
      success: true,
      message: `${vouchers.length} vouchers generated`,
      data: { vouchers },
    });
  } catch (err) {
    console.error('[vouchers POST /generate]', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

// GET /api/vouchers/pdf - must come before /:id
router.get('/pdf', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const { ids, profile_id } = req.query;
    let vouchers = [];

    if (ids) {
      const idList = ids.split(',').map((id) => parseInt(id.trim())).filter(Boolean);
      if (idList.length === 0) {
        return res.status(400).json({ success: false, message: 'No valid IDs provided' });
      }
      vouchers = await Promise.all(idList.map((id) => Voucher.findById(id)));
      vouchers = vouchers.filter(Boolean);
    } else if (profile_id) {
      vouchers = await Voucher.list({ profile_id: parseInt(profile_id) });
    } else {
      return res.status(400).json({ success: false, message: 'Provide ids or profile_id query parameter' });
    }

    if (vouchers.length === 0) {
      return res.status(404).json({ success: false, message: 'No vouchers found' });
    }

    const pdfBuffer = await voucherService.generateVoucherPDF(vouchers, {
      ssid: process.env.HOTSPOT_SSID || process.env.APP_NAME || 'Hotspay',
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="vouchers.pdf"',
      'Content-Length': pdfBuffer.length,
    });
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('[vouchers GET /pdf]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/vouchers/sync - must come before /:id
router.post('/sync', authenticate, requireRole('cashier'), async (req, res) => {
  try {
    const { router_id } = req.body;
    if (!router_id) {
      return res.status(400).json({ success: false, message: 'router_id is required' });
    }

    const result = await mikrotikService.syncUsers(parseInt(router_id));
    return res.json({ success: true, message: 'Vouchers synced with MikroTik', data: result });
  } catch (err) {
    console.error('[vouchers POST /sync]', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

// GET /api/vouchers/:id
router.get('/:id', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid voucher ID' });

    const voucher = await Voucher.findById(id);
    if (!voucher) return res.status(404).json({ success: false, message: 'Voucher not found' });

    return res.json({ success: true, message: 'Voucher retrieved', data: { voucher } });
  } catch (err) {
    console.error('[vouchers GET /:id]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// DELETE /api/vouchers/:id - super_admin only
router.delete('/:id', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid voucher ID' });

    const voucher = await Voucher.findById(id);
    if (!voucher) return res.status(404).json({ success: false, message: 'Voucher not found' });

    await Voucher.delete(id);
    return res.json({ success: true, message: 'Voucher deleted successfully' });
  } catch (err) {
    console.error('[vouchers DELETE /:id]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/vouchers/:id/qr
router.get('/:id/qr', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid voucher ID' });

    const voucher = await Voucher.findById(id);
    if (!voucher) return res.status(404).json({ success: false, message: 'Voucher not found' });

    const qrDataUrl = await voucherService.generateQRCode(voucher);
    return res.json({ success: true, message: 'QR code generated', data: { qr: qrDataUrl } });
  } catch (err) {
    console.error('[vouchers GET /:id/qr]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/vouchers/:id/push - push single voucher to MikroTik
router.post('/:id/push', authenticate, requireRole('cashier'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid voucher ID' });

    const voucher = await Voucher.findById(id);
    if (!voucher) return res.status(404).json({ success: false, message: 'Voucher not found' });

    await voucherService.pushVoucherToMikrotik(voucher);
    return res.json({ success: true, message: 'Voucher pushed to MikroTik router' });
  } catch (err) {
    console.error('[vouchers POST /:id/push]', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

module.exports = router;
