/**
 * TetraSync Technologies - Production Server Entry Point
 * Hardened Express Backend with Native SQLite & Defense-in-Depth AppSec
 */
'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { globalApiLimiter } = require('./security');

const app = express();

// 1. AppSec Hardening: Disable fingerprinting headers
app.disable('x-powered-by');

// 2. Helmet Security Headers (HSTS, NoSniff, Clickjacking Denial)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://cdn.tailwindcss.com",
        "https://cdn.jsdelivr.net",
        "https://unpkg.com"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://cdn.tailwindcss.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "data:"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https:"
      ],
      connectSrc: [
        "'self'",
        "https://fonts.googleapis.com",
        "https://fonts.gstatic.com",
        "https://cdn.tailwindcss.com"
      ],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: null
    }
  },
  crossOriginEmbedderPolicy: false
}));

// 3. CORS
app.use(cors({
  origin: true,
  credentials: true
}));

// 4. Request Body Clamping (DoS & Memory Exhaustion Mitigation)
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: true, limit: '32kb' }));

// 5. Cookie Parser for Signed HttpOnly Sessions
app.use(cookieParser(config.sessionSecret));

// 6. Global API Rate Limiter
app.use('/api', globalApiLimiter);

// 7. Health Check Telemetry
app.get('/api/health', (req, res) => {
  let dbStatus = 'connected';
  try {
    const { stmts } = require('./db');
    stmts.countEnquiries.get();
  } catch (e) {
    dbStatus = 'disconnected';
  }

  res.json({
    status: 'ONLINE',
    database: dbStatus,
    system: 'TetraSync Technologies Core Engine',
    version: '1.0.0',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// 8. REST API Routes
app.use('/api/enquiry', require('./routes/enquiry'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));

// 9. Founder Admin Dashboard Entry Point
app.get('/admin', (req, res) => {
  res.sendFile(path.join(config.adminPublicDir, 'admin.html'));
});

// 10. Serve Production Website Static Files
// Note: Isolated strictly to website/ directory; dotfiles and sensitive database files are ignored
app.use(express.static(config.staticDir, {
  dotfiles: 'ignore',
  index: 'index.html',
  maxAge: config.isProd ? '1d' : 0
}));

// Fallback for HTML5 routing or missing assets
app.get('*', (req, res, next) => {
  if (req.accepts('html')) {
    res.sendFile(path.join(config.staticDir, 'index.html'));
  } else {
    next();
  }
});

// 11. Centralized Production Error Shield
app.use((err, req, res, next) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
  const status = err.status || 500;
  res.status(status).json({
    error: 'Internal Server Error',
    message: config.isProd ? 'An error occurred while processing your request' : err.message,
    code: 'TST-SEC-ERR'
  });
});

// 12. Start Server
if (require.main === module) {
  const server = app.listen(config.port, () => {
    console.log('================================================================');
    console.log(`  TETRASYNC TECHNOLOGIES - PRODUCTION BACKEND SERVER ACTIVE`);
    console.log(`  Synchronizing Silicon & Code`);
    console.log('================================================================');
    console.log(`  > Main Website:     http://localhost:${config.port}`);
    console.log(`  > Founder Portal:   http://localhost:${config.port}/admin`);
    console.log(`  > API Health:       http://localhost:${config.port}/api/health`);
    console.log(`  > Database:         ${config.dbPath} (WAL Mode)`);
    console.log(`  > Admin Passphrase: [CONFIGURED]`);
    console.log(`  > Email Dispatch:   ${config.smtp.isConfigured ? 'SMTP LIVE (' + config.smtp.host + ')' : 'SIMULATED LOGGING -> ' + config.recipientEmail}`);
    console.log('================================================================');
  });

  // Graceful Shutdown
  const shutdown = () => {
    console.log('\n[SHUTDOWN] Terminating server gracefully...');
    server.close(() => {
      console.log('[SHUTDOWN] Connections closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = app;
