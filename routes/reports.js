'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const reportService = require('../services/reportService');

// GET /api/reports/dashboard
router.get('/dashboard', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const stats = await reportService.getDashboardStats();
    return res.json({ success: true, message: 'Dashboard statistics retrieved', data: stats });
  } catch (err) {
    console.error('[reports GET /dashboard]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/reports/revenue?period=daily|weekly|monthly&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/revenue', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const period = ['daily', 'weekly', 'monthly'].includes(req.query.period) ? req.query.period : 'daily';
    const { from, to } = req.query;
    const data = await reportService.getRevenueChart(period, from, to);
    return res.json({ success: true, message: 'Revenue chart data retrieved', data: { period, rows: data, chart: data } });
  } catch (err) {
    console.error('[reports GET /revenue]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/reports/users?period=daily|weekly|monthly
router.get('/users', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const period = ['daily', 'weekly', 'monthly'].includes(req.query.period) ? req.query.period : 'daily';
    const data = await reportService.getUsersChart(period);
    return res.json({ success: true, message: 'Users chart data retrieved', data: { period, chart: data } });
  } catch (err) {
    console.error('[reports GET /users]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/reports/sessions
router.get('/sessions', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const { customer_id, voucher_id, router_id, from_date, to_date, limit, offset } = req.query;
    const filters = {};
    if (customer_id) filters.customer_id = parseInt(customer_id);
    if (voucher_id) filters.voucher_id = parseInt(voucher_id);
    if (router_id) filters.router_id = parseInt(router_id);
    if (from_date) filters.from_date = from_date;
    if (to_date) filters.to_date = to_date;
    if (limit) filters.limit = parseInt(limit);
    if (offset) filters.offset = parseInt(offset);

    const sessions = await reportService.getSessionHistory(filters);
    return res.json({ success: true, message: 'Session history retrieved', data: { sessions } });
  } catch (err) {
    console.error('[reports GET /sessions]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/reports/bandwidth
router.get('/bandwidth', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const { router_id, from_date, to_date, limit, offset } = req.query;
    const filters = {};
    if (router_id) filters.router_id = parseInt(router_id);
    if (from_date) filters.from_date = from_date;
    if (to_date) filters.to_date = to_date;
    if (limit) filters.limit = parseInt(limit);
    if (offset) filters.offset = parseInt(offset);

    const bandwidth = await reportService.getBandwidthUsage(filters);
    return res.json({ success: true, message: 'Bandwidth usage retrieved', data: { bandwidth } });
  } catch (err) {
    console.error('[reports GET /bandwidth]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/reports/export/pdf
router.get('/export/pdf', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const { type = 'revenue', period, from_date, to_date, router_id } = req.query;
    let data = [];
    let title = 'Report';

    if (type === 'revenue') {
      const p = ['daily', 'weekly', 'monthly'].includes(period) ? period : 'daily';
      data = await reportService.getRevenueChart(p);
      title = `Revenue Report (${p})`;
    } else if (type === 'sessions') {
      const filters = {};
      if (from_date) filters.from_date = from_date;
      if (to_date) filters.to_date = to_date;
      if (router_id) filters.router_id = parseInt(router_id);
      data = await reportService.getSessionHistory(filters);
      title = 'Session History Report';
    } else if (type === 'bandwidth') {
      const filters = {};
      if (from_date) filters.from_date = from_date;
      if (to_date) filters.to_date = to_date;
      if (router_id) filters.router_id = parseInt(router_id);
      data = await reportService.getBandwidthUsage(filters);
      title = 'Bandwidth Usage Report';
    }

    const pdfBuffer = await reportService.generatePDFReport(data, title);
    const filename = `${title.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('[reports GET /export/pdf]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/reports/export/excel
router.get('/export/excel', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const { type = 'revenue', period, from_date, to_date, router_id } = req.query;
    let data = [];
    let title = 'Report';

    if (type === 'revenue') {
      const p = ['daily', 'weekly', 'monthly'].includes(period) ? period : 'daily';
      data = await reportService.getRevenueChart(p);
      title = `Revenue Report (${p})`;
    } else if (type === 'sessions') {
      const filters = {};
      if (from_date) filters.from_date = from_date;
      if (to_date) filters.to_date = to_date;
      if (router_id) filters.router_id = parseInt(router_id);
      data = await reportService.getSessionHistory(filters);
      title = 'Session History Report';
    } else if (type === 'bandwidth') {
      const filters = {};
      if (from_date) filters.from_date = from_date;
      if (to_date) filters.to_date = to_date;
      if (router_id) filters.router_id = parseInt(router_id);
      data = await reportService.getBandwidthUsage(filters);
      title = 'Bandwidth Usage Report';
    }

    const xlsxBuffer = await reportService.generateExcelReport(data, title);
    const filename = `${title.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.xlsx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return res.send(xlsxBuffer);
  } catch (err) {
    console.error('[reports GET /export/excel]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/reports/export/csv
router.get('/export/csv', authenticate, requireRole('viewer'), async (req, res) => {
  try {
    const { type = 'revenue', period, from_date, to_date, router_id } = req.query;
    let data = [];
    let title = 'report';

    if (type === 'revenue') {
      const p = ['daily', 'weekly', 'monthly'].includes(period) ? period : 'daily';
      data = await reportService.getRevenueChart(p);
      title = `revenue-${p}`;
    } else if (type === 'sessions') {
      const filters = {};
      if (from_date) filters.from_date = from_date;
      if (to_date) filters.to_date = to_date;
      if (router_id) filters.router_id = parseInt(router_id);
      data = await reportService.getSessionHistory(filters);
      title = 'session-history';
    } else if (type === 'bandwidth') {
      const filters = {};
      if (from_date) filters.from_date = from_date;
      if (to_date) filters.to_date = to_date;
      if (router_id) filters.router_id = parseInt(router_id);
      data = await reportService.getBandwidthUsage(filters);
      title = 'bandwidth-usage';
    }

    const csv = reportService.generateCSVReport(data);
    const filename = `${title}-${Date.now()}.csv`;

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return res.send(csv);
  } catch (err) {
    console.error('[reports GET /export/csv]', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
