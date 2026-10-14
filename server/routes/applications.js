/**
 * TetraSync Technologies - Candidate Job Application Route
 */
'use strict';

const express = require('express');
const router = express.Router();
const { stmts } = require('../db');
const { honeypotTrap, formSubmissionLimiter, sanitizeText, cleanHeaderString } = require('../security');
const { sendApplicationNotification } = require('../mailer');

function rand4() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

router.post('/', formSubmissionLimiter, honeypotTrap, async (req, res) => {
  try {
    const { name, email, phone, role, exp, link, projects } = req.body;

    // Strict Input Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Validation Error', message: 'Full name is required' });
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Validation Error', message: 'Valid email address is required' });
    }
    if (!phone || typeof phone !== 'string' || phone.trim().length < 7) {
      return res.status(400).json({ error: 'Validation Error', message: 'Valid phone contact is required' });
    }
    if (!role || typeof role !== 'string' || role.trim().length === 0) {
      return res.status(400).json({ error: 'Validation Error', message: 'Target position is required' });
    }
    if (!exp || typeof exp !== 'string') {
      return res.status(400).json({ error: 'Validation Error', message: 'Experience level is required' });
    }

    // URL Protocol Validation to prevent javascript: or data: URIs
    let safeLink = '';
    if (link && typeof link === 'string' && link.trim().length > 0) {
      const trimmed = link.trim();
      if (!/^https?:\/\//i.test(trimmed)) {
        return res.status(400).json({ error: 'Validation Error', message: 'Portfolio link must start with http:// or https://' });
      }
      safeLink = trimmed.slice(0, 500);
    }

    const safeName = cleanHeaderString(name);
    const safeEmail = cleanHeaderString(email);
    const safePhone = cleanHeaderString(phone);
    const safeRole = cleanHeaderString(role);
    const safeExp = cleanHeaderString(exp);
    const safeProjects = sanitizeText(projects || '', 5000);

    const id = `#APP-2026-${rand4()}`;
    const createdAt = new Date().toISOString();
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    // Parameterized Database Insertion
    stmts.insertApplication.run(
      id,
      safeName,
      safeEmail,
      safePhone,
      safeRole,
      safeExp,
      safeLink,
      safeProjects,
      createdAt,
      clientIp
    );

    // Asynchronous notification
    const appRecord = {
      id,
      name: safeName,
      email: safeEmail,
      phone: safePhone,
      role: safeRole,
      experience: safeExp,
      portfolio_link: safeLink,
      projects: safeProjects,
      createdAt
    };

    sendApplicationNotification(appRecord).catch(err => {
      console.error('[APPLICATION NOTIFICATION ERROR]', err.message);
    });

    return res.status(201).json({
      success: true,
      id,
      message: 'Application recorded successfully',
      timestamp: createdAt
    });
  } catch (err) {
    console.error('[API APPLICATION ERROR]', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Unable to submit application at this time.'
    });
  }
});

module.exports = router;
