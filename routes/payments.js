'use strict';

const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const Transaction = require('../models/Transaction');
const Voucher = require('../models/Voucher');
const mpesaService = require('../services/mpesaService');
const paypalService = require('../services/paypalService');

// GET /api/payments - list transactions
router.get('/', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const { customer_id, payment_method, status, from_date, to_date, limit, offset } = req.query;
    const filters = {};
    if (customer_id) filters.customer_id = parseInt(customer_id);
    if (payment_method) filters.payment_method = payment_method;
    if (status) filters.status = status;
    if (from_date) filters.from_date = from_date;
    if (to_date) filters.to_date = to_date;
    if (limit) filters.limit = parseInt(limit);
    if (offset) filters.offset = parseInt(offset);

    const transactions = await Transaction.list(filters);
    return res.json({ success: true, message: 'Transactions retrieved', data: { transactions } });
  } catch (err) {
    console.error('[payments GET /]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/payments/cash - record cash payment
router.post('/cash', authenticate, requireRole('cashier'), async (req, res) => {
  try {
    const { customer_id, voucher_id, amount, notes } = req.body;
    if (!amount) {
      return res.status(400).json({ success: false, message: 'amount is required' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'amount must be a positive number' });
    }

    const transaction = await Transaction.create({
      customer_id: customer_id ? parseInt(customer_id) : null,
      voucher_id: voucher_id ? parseInt(voucher_id) : null,
      amount: parsedAmount,
      payment_method: 'cash',
      status: 'completed',
      notes,
    });

    if (voucher_id) {
      await Voucher.markAsUsed(parseInt(voucher_id), customer_id ? parseInt(customer_id) : null);
    }

    return res.status(201).json({ success: true, message: 'Cash payment recorded', data: { transaction } });
  } catch (err) {
    console.error('[payments POST /cash]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/payments/mpesa/initiate - initiate M-Pesa STK push
router.post('/mpesa/initiate', authenticate, requireRole('cashier'), async (req, res) => {
  try {
    const { phone, amount, voucher_id, customer_id, description } = req.body;
    if (!phone || !amount) {
      return res.status(400).json({ success: false, message: 'phone and amount are required' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'amount must be a positive number' });
    }

    const accountRef = voucher_id ? `Voucher-${voucher_id}` : 'HotspayWifi';
    const txDesc = description || 'Wi-Fi Voucher Payment';

    const stkResponse = await mpesaService.stkPush(phone, parsedAmount, accountRef, txDesc);

    // Record pending transaction
    const transaction = await Transaction.create({
      customer_id: customer_id ? parseInt(customer_id) : null,
      voucher_id: voucher_id ? parseInt(voucher_id) : null,
      amount: parsedAmount,
      payment_method: 'mpesa',
      payment_reference: stkResponse.CheckoutRequestID,
      status: 'pending',
    });

    return res.json({
      success: true,
      message: 'STK push initiated. Awaiting customer confirmation.',
      data: { transaction, mpesa: stkResponse },
    });
  } catch (err) {
    console.error('[payments POST /mpesa/initiate]', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

// POST /api/payments/mpesa/callback - M-Pesa callback (public, no auth)
router.post('/mpesa/callback', async (req, res) => {
  try {
    const parsed = mpesaService.handleCallback(req.body);

    if (parsed.checkoutRequestId) {
      const transaction = await Transaction.findByReference(parsed.checkoutRequestId);
      if (transaction) {
        const newStatus = parsed.success ? 'completed' : 'failed';
        await Transaction.update(transaction.id, { status: newStatus });

        if (parsed.success && transaction.voucher_id) {
          await Voucher.markAsUsed(transaction.voucher_id, transaction.customer_id || null);
        }
      }
    }

    // Safaricom expects a 200 response
    return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    console.error('[payments POST /mpesa/callback]', err);
    return res.status(500).json({ ResultCode: 1, ResultDesc: 'Internal server error' });
  }
});

// POST /api/payments/paypal/create-order
router.post('/paypal/create-order', authenticate, requireRole('cashier'), async (req, res) => {
  try {
    const { amount, currency, description, voucher_id, customer_id } = req.body;
    if (!amount) {
      return res.status(400).json({ success: false, message: 'amount is required' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'amount must be a positive number' });
    }

    const order = await paypalService.createOrder(parsedAmount, currency || 'USD', description || 'Wi-Fi Voucher');

    // Record pending transaction linked to PayPal order ID
    const transaction = await Transaction.create({
      customer_id: customer_id ? parseInt(customer_id) : null,
      voucher_id: voucher_id ? parseInt(voucher_id) : null,
      amount: parsedAmount,
      payment_method: 'paypal',
      payment_reference: order.id,
      status: 'pending',
    });

    return res.json({
      success: true,
      message: 'PayPal order created',
      data: { transaction, order },
    });
  } catch (err) {
    console.error('[payments POST /paypal/create-order]', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

// POST /api/payments/paypal/capture
router.post('/paypal/capture', authenticate, requireRole('cashier'), async (req, res) => {
  try {
    const { order_id } = req.body;
    if (!order_id) {
      return res.status(400).json({ success: false, message: 'order_id is required' });
    }

    const captured = await paypalService.captureOrder(order_id);

    const transaction = await Transaction.findByReference(order_id);
    if (transaction) {
      const newStatus =
        captured.status === 'COMPLETED' ? 'completed' : 'failed';
      await Transaction.update(transaction.id, { status: newStatus });

      if (newStatus === 'completed' && transaction.voucher_id) {
        await Voucher.markAsUsed(transaction.voucher_id, transaction.customer_id || null);
      }
    }

    return res.json({
      success: true,
      message: 'PayPal order captured',
      data: { capture: captured, transaction: transaction || null },
    });
  } catch (err) {
    console.error('[payments POST /paypal/capture]', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

// GET /api/payments/:id - get transaction details
router.get('/:id', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid transaction ID' });

    const transaction = await Transaction.findById(id);
    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });

    return res.json({ success: true, message: 'Transaction retrieved', data: { transaction } });
  } catch (err) {
    console.error('[payments GET /:id]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/payments/:id/receipt - download PDF receipt
router.get('/:id/receipt', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid transaction ID' });

    const transaction = await Transaction.findById(id);
    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });

    let voucher = null;
    if (transaction.voucher_id) {
      voucher = await Voucher.findById(transaction.voucher_id);
    }

    const appName = process.env.APP_NAME || 'Hotspay';

    const pdfBuffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A5' });
      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      doc.fontSize(18).fillColor('#2563eb').font('Helvetica-Bold').text(appName, { align: 'center' });
      doc.fontSize(13).fillColor('#333').font('Helvetica-Bold').text('Payment Receipt', { align: 'center' });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#e0e0e0').stroke();
      doc.moveDown(0.5);

      const line = (label, value) => {
        doc.fontSize(10).fillColor('#888').font('Helvetica').text(label, { continued: true, width: 140 });
        doc.fillColor('#333').font('Helvetica-Bold').text(value || '-');
      };

      line('Receipt No:', transaction.receipt_number);
      line('Amount:', `${Number(transaction.amount).toFixed(2)}`);
      line('Payment Method:', transaction.payment_method);
      line('Status:', transaction.status);
      line('Customer:', transaction.customer_name || 'Walk-in');
      line('Phone:', transaction.customer_phone || '-');
      line('Date:', new Date(transaction.created_at).toLocaleString());
      if (transaction.notes) line('Notes:', transaction.notes);

      if (voucher) {
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#e0e0e0').stroke();
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor('#2563eb').font('Helvetica-Bold').text('Wi-Fi Voucher', { align: 'center' });
        line('Username:', voucher.username);
        line('Password:', voucher.password);
        if (voucher.profile_name) line('Plan:', voucher.profile_name);
      }

      doc.moveDown(1);
      doc.fontSize(9).fillColor('#aaa').font('Helvetica').text(`Powered by ${appName}`, { align: 'center' });
      doc.end();
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="receipt-${transaction.receipt_number}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('[payments GET /:id/receipt]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
