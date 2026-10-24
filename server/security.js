/**
 * TetraSync Technologies - AppSec & Defense-in-Depth Security Middleware
 */
'use strict';

const crypto = require('crypto');
const config = require('./config');
const { stmts } = require('./db');

// ---------- 1. Cryptographic Constant-Time Comparison ----------
function timingSafeVerify(candidate, secret) {
  if (typeof candidate !== 'string' || typeof secret !== 'string') return false;
  const hashA = crypto.createHash('sha256').update(candidate).digest();
  const hashB = crypto.createHash('sha256').update(secret).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

// ---------- 2. Input Sanitization (XSS & SMTP Header Injection) ----------
function cleanHeaderString(val) {
  if (val == null) return '';
  // Strip CR, LF, and null bytes to prevent SMTP header injection
  return String(val).replace(/[\r\n\0]/g, ' ').trim().slice(0, 255);
}

function escapeHtml(val) {
  if (val == null) return '';
  return String(val).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function sanitizeText(val, maxLength = 5000) {
  if (val == null) return '';
  return String(val).trim().slice(0, maxLength);
}

// ---------- 3. Anti-Bot Honeypot Middleware ----------
function honeypotTrap(req, res, next) {
  const trapValue = req.body._penta_guard || req.body._tetra_guard;
  if (trapValue && String(trapValue).trim().length > 0) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const ua = req.get('user-agent') || 'unknown';
    const fieldName = req.body._penta_guard ? '_penta_guard' : '_tetra_guard';

    try {
      stmts.insertSecurityLog.run(
        'HONEYPOT_BOT_TRAPPED',
        ip,
        ua.slice(0, 255),
        JSON.stringify({ triggeredField: fieldName, value: String(trapValue).slice(0, 100) }),
        new Date().toISOString()
      );
    } catch (e) {
      // Ignore log error
    }

    // Silent neutralization: Return 200 OK so the automated bot believes it succeeded
    return res.status(200).json({
      success: true,
      id: '#TST-2026-0000',
      message: 'Transmission received'
    });
  }
  next();
}

// ---------- 4. Rate Limiting (In-Memory Sliding Window) ----------
function createRateLimiter(windowMs, maxRequests, eventName = 'RATE_LIMIT_EXCEEDED') {
  const hits = new Map();

  // Periodically clean expired entries
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of hits.entries()) {
      if (now - record.startTime > windowMs) {
        hits.delete(ip);
      }
    }
  }, Math.min(windowMs, 60000)).unref();

  return function rateLimitMiddleware(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    let record = hits.get(ip);
    if (!record || now - record.startTime > windowMs) {
      record = { count: 1, startTime: now };
      hits.set(ip, record);
      return next();
    }

    record.count++;
    if (record.count > maxRequests) {
      try {
        stmts.insertSecurityLog.run(
          eventName,
          ip,
          (req.get('user-agent') || '').slice(0, 255),
          JSON.stringify({ path: req.path, hits: record.count, limit: maxRequests }),
          new Date().toISOString()
        );
      } catch (e) {}

      res.setHeader('Retry-After', Math.ceil((windowMs - (now - record.startTime)) / 1000));
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Request rate threshold reached. Please wait before retrying.'
      });
    }

    next();
  };
}

// 5 submissions per 10 minutes for public forms
const formSubmissionLimiter = createRateLimiter(10 * 60 * 1000, 5, 'FORM_RATE_EXCEEDED');

// 5 login attempts per 15 minutes for admin portal
const loginAttemptLimiter = createRateLimiter(15 * 60 * 1000, 5, 'ADMIN_LOGIN_BRUTE_FORCE');

// Global API limiter (150 requests per 15 minutes)
const globalApiLimiter = createRateLimiter(15 * 60 * 1000, 150, 'GLOBAL_API_RATE_EXCEEDED');

// ---------- 5. Session Authentication ----------
const COOKIE_NAME = 'tst_admin_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function hashToken(token) {
  return crypto.createHmac('sha256', config.sessionSecret).update(token).digest('hex');
}

function createSession(ip, adminName = 'Founder') {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

  stmts.insertSession.run(tokenHash, now.toISOString(), expiresAt.toISOString(), ip, adminName);
  return { rawToken, expiresAt, adminName };
}

function validateSession(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return null;
  const tokenHash = hashToken(rawToken);
  const row = stmts.getSession.get(tokenHash, new Date().toISOString());
  if (!row) return null;
  return {
    valid: true,
    adminName: row.admin_name || 'Founder',
    createdAt: row.created_at,
    expiresAt: row.expires_at
  };
}

function destroySession(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return;
  const tokenHash = hashToken(rawToken);
  stmts.deleteSession.run(tokenHash);
}

// Admin Authentication Guard
function requireAdminAuth(req, res, next) {
  // Check signed/unsigned cookie or Authorization header
  let token = req.cookies ? req.cookies[COOKIE_NAME] : null;

  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }
  }

  const session = token ? validateSession(token) : null;
  if (!token || !session) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid founder admin authentication required'
    });
  }

  req.adminName = session.adminName;
  next();
}

module.exports = {
  timingSafeVerify,
  cleanHeaderString,
  escapeHtml,
  sanitizeText,
  honeypotTrap,
  formSubmissionLimiter,
  loginAttemptLimiter,
  globalApiLimiter,
  COOKIE_NAME,
  createSession,
  validateSession,
  destroySession,
  requireAdminAuth
};
