/**
 * TetraSync Technologies - Authentication Routes
 * Timing-Safe Password Verification & HttpOnly Session Management
 */
'use strict';

const express = require('express');
const router = express.Router();
const config = require('../config');
const { stmts } = require('../db');
const {
  timingSafeVerify,
  loginAttemptLimiter,
  createSession,
  validateSession,
  destroySession,
  COOKIE_NAME
} = require('../security');

// POST /api/auth/login
router.post('/login', loginAttemptLimiter, (req, res) => {
  const { password, name } = req.body;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const ua = req.get('user-agent') || 'unknown';

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Bad Request', message: 'Password is required' });
  }

  // Founder / Admin name
  const founderName = (typeof name === 'string' && name.trim().length > 0)
    ? name.trim().slice(0, 100)
    : 'Executive Founder';

  // Cryptographic constant-time comparison prevents timing side-channel attacks
  const isValid = timingSafeVerify(password, config.adminPassword);

  if (!isValid) {
    try {
      stmts.insertSecurityLog.run(
        'FAILED_ADMIN_LOGIN',
        ip,
        ua.slice(0, 255),
        JSON.stringify({ path: '/api/auth/login', attemptedFounder: founderName }),
        new Date().toISOString()
      );
    } catch (e) {}

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid founder master credentials'
    });
  }

  // Issue cryptographically secure session with founder name
  const { rawToken, expiresAt, adminName } = createSession(ip, founderName);

  // Set signed/secure HttpOnly cookie (immune to XSS theft)
  res.cookie(COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: config.isProd, // true in HTTPS production
    sameSite: 'strict',
    expires: expiresAt,
    path: '/'
  });

  return res.json({
    success: true,
    message: 'Founder authentication successful',
    adminName,
    expiresAt: expiresAt.toISOString()
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const token = req.cookies ? req.cookies[COOKIE_NAME] : null;
  if (token) {
    destroySession(token);
  }

  res.clearCookie(COOKIE_NAME, { path: '/' });
  return res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/auth/status
router.get('/status', (req, res) => {
  let token = req.cookies ? req.cookies[COOKIE_NAME] : null;
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7).trim();
  }

  const session = token ? validateSession(token) : null;
  return res.json({
    authenticated: Boolean(session),
    adminName: session ? session.adminName : null
  });
});

module.exports = router;
