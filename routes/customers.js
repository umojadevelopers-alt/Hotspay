'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const Customer = require('../models/Customer');
const Voucher = require('../models/Voucher');

// GET /api/customers
router.get('/', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const { search, is_active, limit, offset } = req.query;
    const filters = {};
    if (search) filters.search = search;
    if (is_active !== undefined) filters.is_active = is_active === 'true' || is_active === '1';
    if (limit) filters.limit = parseInt(limit);
    if (offset) filters.offset = parseInt(offset);

    const customers = await Customer.list(filters);
    return res.json({ success: true, message: 'Customers retrieved', data: { customers } });
  } catch (err) {
    console.error('[customers GET /]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/customers
router.post('/', authenticate, requireRole('cashier'), async (req, res) => {
  try {
    const { name, phone, email, address, notes } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'name and phone are required' });
    }

    const customer = await Customer.create({ name, phone, email, address, notes });
    return res.status(201).json({ success: true, message: 'Customer created', data: { customer } });
  } catch (err) {
    console.error('[customers POST /]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/customers/:id
router.get('/:id', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid customer ID' });

    const customer = await Customer.findById(id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    return res.json({ success: true, message: 'Customer retrieved', data: { customer } });
  } catch (err) {
    console.error('[customers GET /:id]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PUT /api/customers/:id
router.put('/:id', authenticate, requireRole('cashier'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid customer ID' });

    const customer = await Customer.findById(id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    const { name, phone, email, address, notes, is_active } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (email !== undefined) data.email = email;
    if (address !== undefined) data.address = address;
    if (notes !== undefined) data.notes = notes;
    if (is_active !== undefined) data.is_active = is_active;

    const updated = await Customer.update(id, data);
    return res.json({ success: true, message: 'Customer updated', data: { customer: updated } });
  } catch (err) {
    console.error('[customers PUT /:id]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// DELETE /api/customers/:id - super_admin only
router.delete('/:id', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid customer ID' });

    const customer = await Customer.findById(id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    await Customer.delete(id);
    return res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (err) {
    console.error('[customers DELETE /:id]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/customers/:id/sessions
router.get('/:id/sessions', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid customer ID' });

    const customer = await Customer.findById(id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    const sessions = await Customer.getSessionHistory(id);
    return res.json({ success: true, message: 'Session history retrieved', data: { sessions } });
  } catch (err) {
    console.error('[customers GET /:id/sessions]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/customers/:id/vouchers
router.get('/:id/vouchers', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid customer ID' });

    const customer = await Customer.findById(id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    const vouchers = await Voucher.list({ customer_id: id });
    return res.json({ success: true, message: 'Customer vouchers retrieved', data: { vouchers } });
  } catch (err) {
    console.error('[customers GET /:id/vouchers]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
