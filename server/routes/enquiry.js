/**
 * TetraSync Technologies - Technical Brief / Project Enquiry Route
 */
'use strict';

const express = require('express');
const router = express.Router();
const { stmts } = require('../db');
const { honeypotTrap, formSubmissionLimiter, sanitizeText, cleanHeaderString } = require('../security');
const { sendEnquiryNotification } = require('../mailer');

function rand4() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

router.post('/', formSubmissionLimiter, honeypotTrap, async (req, res) => {
  try {
    const { name, email, company, phase, disc, scope } = req.body;

    // Strict Input Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Validation Error', message: 'Name is required' });
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Validation Error', message: 'Valid email address is required' });
    }
    if (!scope || typeof scope !== 'string' || scope.trim().length < 5) {
      return res.status(400).json({ error: 'Validation Error', message: 'Project scope details are required (minimum 5 characters)' });
    }

    const safeName = cleanHeaderString(name);
    const safeEmail = cleanHeaderString(email);
    const safeCompany = cleanHeaderString(company || 'Individual / Founder');
    const safePhase = cleanHeaderString(phase || 'Specification');
    const safeScope = sanitizeText(scope, 8000);

    let safeDisciplines = [];
    if (Array.isArray(disc)) {
      safeDisciplines = disc.map(d => cleanHeaderString(d)).filter(Boolean);
    } else if (typeof disc === 'string' && disc) {
      safeDisciplines = [cleanHeaderString(disc)];
    }

    const id = `#TST-2026-${rand4()}`;
    const createdAt = new Date().toISOString();
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    // Parameterized Database Insertion (SQL Injection immune)
    stmts.insertEnquiry.run(
      id,
      safeName,
      safeEmail,
      safeCompany,
      safePhase,
      JSON.stringify(safeDisciplines),
      safeScope,
      createdAt,
      clientIp
    );

    // Asynchronous email notification (does not block client response)
    const enquiryRecord = {
      id,
      name: safeName,
      email: safeEmail,
      company: safeCompany,
      phase: safePhase,
      disciplines: safeDisciplines,
      scope: safeScope,
      createdAt
    };

    sendEnquiryNotification(enquiryRecord).catch(err => {
      console.error('[ENQUIRY NOTIFICATION ERROR]', err.message);
    });

    return res.status(201).json({
      success: true,
      id,
      message: 'Technical brief officially recorded',
      timestamp: createdAt
    });
  } catch (err) {
    console.error('[API ENQUIRY ERROR]', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Unable to process technical brief at this time.'
    });
  }
});

module.exports = router;
