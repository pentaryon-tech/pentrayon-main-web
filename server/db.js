/**
 * TetraSync Technologies - Database Layer (Native node:sqlite)
 * Zero external database daemon dependencies.
 */
'use strict';

const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const config = require('./config');

// Ensure parent data/ directory exists
const dataDir = path.dirname(config.dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Connect to SQLite database in data/tetrasync.db
const db = new DatabaseSync(config.dbPath);

// Enable WAL mode for high concurrent read/write throughput
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize tables if they do not exist
db.exec(`
  CREATE TABLE IF NOT EXISTS enquiries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT,
    phase TEXT,
    disciplines TEXT,
    scope TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL,
    client_ip TEXT
  );

  CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    role TEXT NOT NULL,
    experience TEXT NOT NULL,
    portfolio_link TEXT,
    projects TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL,
    client_ip TEXT
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    client_ip TEXT,
    admin_name TEXT DEFAULT 'Founder'
  );

  CREATE TABLE IF NOT EXISTS security_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    details TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_enquiries_created ON enquiries (created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries (status);
  CREATE INDEX IF NOT EXISTS idx_apps_created ON applications (created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_apps_status ON applications (status);
  CREATE INDEX IF NOT EXISTS idx_sec_created ON security_logs (created_at DESC);
`);

// Migration safeguard for existing databases
try {
  db.exec(`ALTER TABLE admin_sessions ADD COLUMN admin_name TEXT DEFAULT 'Founder';`);
} catch (e) {
  // Column already exists
}

// Prepared statement helpers for performance and SQL Injection immunity
const stmts = {
  // Enquiries
  insertEnquiry: db.prepare(`
    INSERT INTO enquiries (id, name, email, company, phase, disciplines, scope, status, created_at, client_ip)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `),
  getEnquiries: db.prepare(`
    SELECT * FROM enquiries ORDER BY created_at DESC LIMIT ? OFFSET ?
  `),
  getEnquiryById: db.prepare(`
    SELECT * FROM enquiries WHERE id = ?
  `),
  updateEnquiryStatus: db.prepare(`
    UPDATE enquiries SET status = ? WHERE id = ?
  `),
  countEnquiries: db.prepare(`
    SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending FROM enquiries
  `),

  deleteEnquiry: db.prepare(`
    DELETE FROM enquiries WHERE id = ?
  `),

  // Applications
  insertApplication: db.prepare(`
    INSERT INTO applications (id, name, email, phone, role, experience, portfolio_link, projects, status, created_at, client_ip)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `),
  getApplications: db.prepare(`
    SELECT * FROM applications ORDER BY created_at DESC LIMIT ? OFFSET ?
  `),
  getApplicationById: db.prepare(`
    SELECT * FROM applications WHERE id = ?
  `),
  updateApplicationStatus: db.prepare(`
    UPDATE applications SET status = ? WHERE id = ?
  `),
  deleteApplication: db.prepare(`
    DELETE FROM applications WHERE id = ?
  `),
  countApplications: db.prepare(`
    SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending FROM applications
  `),

  // Sessions
  insertSession: db.prepare(`
    INSERT INTO admin_sessions (token_hash, created_at, expires_at, client_ip, admin_name)
    VALUES (?, ?, ?, ?, ?)
  `),
  getSession: db.prepare(`
    SELECT * FROM admin_sessions WHERE token_hash = ? AND expires_at > ?
  `),
  deleteSession: db.prepare(`
    DELETE FROM admin_sessions WHERE token_hash = ?
  `),
  cleanExpiredSessions: db.prepare(`
    DELETE FROM admin_sessions WHERE expires_at <= ?
  `),

  // Security Logs
  insertSecurityLog: db.prepare(`
    INSERT INTO security_logs (event_type, ip_address, user_agent, details, created_at)
    VALUES (?, ?, ?, ?, ?)
  `),
  getSecurityLogs: db.prepare(`
    SELECT * FROM security_logs ORDER BY created_at DESC LIMIT ?
  `),
  clearSecurityLogs: db.prepare(`
    DELETE FROM security_logs
  `)
};

module.exports = {
  db,
  stmts
};
