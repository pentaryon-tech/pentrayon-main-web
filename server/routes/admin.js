/**
 * TetraSync Technologies - Founder Admin API Routes
 * Zero-Trust Management Interface for Kishore, Akshay, Joshua, and Jason
 */
'use strict';

const express = require('express');
const router = express.Router();
const { stmts } = require('../db');
const { requireAdminAuth, cleanHeaderString } = require('../security');

// Enforce authentication for all /api/admin routes
router.use(requireAdminAuth);

// GET /api/admin/metrics
router.get('/metrics', (req, res) => {
  try {
    const enqCounts = stmts.countEnquiries.get() || { total: 0, pending: 0 };
    const appCounts = stmts.countApplications.get() || { total: 0, pending: 0 };
    const logs = stmts.getSecurityLogs.all(10);

    return res.json({
      success: true,
      enquiries: {
        total: enqCounts.total || 0,
        pending: enqCounts.pending || 0
      },
      applications: {
        total: appCounts.total || 0,
        pending: appCounts.pending || 0
      },
      recentLogs: logs
    });
  } catch (err) {
    console.error('[ADMIN METRICS ERROR]', err);
    return res.status(500).json({ error: 'Database Error', message: 'Unable to query metrics' });
  }
});

// GET /api/admin/enquiries
router.get('/enquiries', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const rows = stmts.getEnquiries.all(limit, offset);
    // Parse JSON disciplines safely
    const parsed = rows.map(r => {
      let disc = [];
      try { disc = JSON.parse(r.disciplines || '[]'); } catch (e) {}
      return Object.assign({}, r, { disciplines: disc });
    });

    return res.json({ success: true, data: parsed, count: parsed.length });
  } catch (err) {
    console.error('[ADMIN GET ENQUIRIES ERROR]', err);
    return res.status(500).json({ error: 'Database Error', message: 'Unable to retrieve enquiries' });
  }
});

// PATCH /api/admin/enquiries/:id
router.patch('/enquiries/:id', (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;
    const allowed = ['pending', 'reviewed', 'contacted', 'archived'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid Status', message: `Status must be one of: ${allowed.join(', ')}` });
    }

    stmts.updateEnquiryStatus.run(cleanHeaderString(status), id);
    return res.json({ success: true, id, status });
  } catch (err) {
    console.error('[ADMIN UPDATE ENQUIRY ERROR]', err);
    return res.status(500).json({ error: 'Database Error', message: 'Unable to update status' });
  }
});

// DELETE /api/admin/enquiries/:id
router.delete('/enquiries/:id', (req, res) => {
  try {
    const id = req.params.id;
    stmts.deleteEnquiry.run(id);
    return res.json({ success: true, message: `Enquiry ${id} deleted` });
  } catch (err) {
    console.error('[ADMIN DELETE ENQUIRY ERROR]', err);
    return res.status(500).json({ error: 'Database Error', message: 'Unable to delete enquiry' });
  }
});

// GET /api/admin/applications
router.get('/applications', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const rows = stmts.getApplications.all(limit, offset);
    return res.json({ success: true, data: rows, count: rows.length });
  } catch (err) {
    console.error('[ADMIN GET APPLICATIONS ERROR]', err);
    return res.status(500).json({ error: 'Database Error', message: 'Unable to retrieve applications' });
  }
});

// PATCH /api/admin/applications/:id
router.patch('/applications/:id', (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;
    const allowed = ['pending', 'shortlisted', 'rejected', 'hired'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid Status', message: `Status must be one of: ${allowed.join(', ')}` });
    }

    stmts.updateApplicationStatus.run(cleanHeaderString(status), id);
    return res.json({ success: true, id, status });
  } catch (err) {
    console.error('[ADMIN UPDATE APPLICATION ERROR]', err);
    return res.status(500).json({ error: 'Database Error', message: 'Unable to update status' });
  }
});

// DELETE /api/admin/applications/:id
router.delete('/applications/:id', (req, res) => {
  try {
    const id = req.params.id;
    stmts.deleteApplication.run(id);
    return res.json({ success: true, message: `Application ${id} deleted` });
  } catch (err) {
    console.error('[ADMIN DELETE APPLICATION ERROR]', err);
    return res.status(500).json({ error: 'Database Error', message: 'Unable to delete application' });
  }
});

// GET /api/admin/security-logs
router.get('/security-logs', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const rows = stmts.getSecurityLogs.all(limit);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[ADMIN GET LOGS ERROR]', err);
    return res.status(500).json({ error: 'Database Error', message: 'Unable to retrieve audit logs' });
  }
});

// DELETE /api/admin/security-logs
router.delete('/security-logs', (req, res) => {
  try {
    const admin = req.adminName || 'Founder';
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const ua = (req.get('user-agent') || 'unknown').slice(0, 255);
    const timestamp = new Date().toISOString();

    stmts.clearSecurityLogs.run();

    // Preserve non-repudiation: record permanent audit entry of who performed the purge
    stmts.insertSecurityLog.run(
      'SECURITY_LOGS_PURGED',
      ip,
      ua,
      JSON.stringify({ purgedBy: admin, reason: 'Administrative maintenance' }),
      timestamp
    );

    return res.json({
      success: true,
      message: `Security audit logs cleared by ${admin}. Audit ledger updated.`,
      purgedBy: admin,
      timestamp
    });
  } catch (err) {
    console.error('[ADMIN CLEAR LOGS ERROR]', err);
    return res.status(500).json({ error: 'Database Error', message: 'Unable to clear audit logs' });
  }
});

module.exports = router;
