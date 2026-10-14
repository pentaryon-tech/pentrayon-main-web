/**
 * TetraSync Technologies - Runtime Configuration & Environment Loader
 */
'use strict';

const path = require('path');
const fs = require('fs');

// Load environment variables from .env
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  adminPassword: process.env.ADMIN_PASSWORD || 'TetraSync',
  sessionSecret: process.env.SESSION_SECRET || 'tetrasync-default-secure-secret-key-2026',
  recipientEmail: process.env.RECIPIENT_EMAIL || 'ideathinigirs@gmail.com',

  // Database location strictly isolated in data/ folder outside web root, or /tmp on Vercel
  dbPath: process.env.VERCEL
    ? path.join('/tmp', 'tetrasync.db')
    : path.resolve(__dirname, '../data/tetrasync.db'),
  // Static files directory: works in root layout or nested inside website
  staticDir: fs.existsSync(path.resolve(__dirname, '../website/index.html'))
    ? path.resolve(__dirname, '../website')
    : path.resolve(__dirname, '..'),
  adminPublicDir: path.resolve(__dirname, './public'),

  // SMTP Settings
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    secure: process.env.SMTP_SECURE === 'true',
    isConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  }
};

module.exports = config;
