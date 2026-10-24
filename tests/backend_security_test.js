/**
 * TetraSync Technologies - Automated Backend Security & Integration Test Suite
 * Evaluates API endpoints, authentication, honeypot traps, SQLi immunity, and session validation.
 */
'use strict';

const http = require('http');
const assert = require('assert');

// Boot server programmatically
const app = require('../server/index');
const config = require('../server/config');
const { db, stmts } = require('../server/db');

const TEST_PORT = 3099;
let server;
let serverUrl;
let enquiryTicketId = '';
let appTicketId = '';

// Helper to make HTTP requests
function request({ method = 'GET', path = '/', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(path, serverUrl);
    const reqHeaders = { ...headers };
    let payload = null;

    if (body) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      reqHeaders['Content-Type'] = reqHeaders['Content-Type'] || 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(parsedUrl, { method, headers: reqHeaders }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = null; }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          text: data,
          json
        });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🔒 PENTARYON BACKEND SECURITY & INTEGRATION TEST SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Health Endpoint
  await test('GET /api/health returns healthy system status and connected database', async () => {
    const res = await request({ method: 'GET', path: '/api/health' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.status, 'ONLINE');
    assert.strictEqual(res.json.database, 'connected');
  });

  // 2. Enquiry Endpoint - Valid Submission
  await test('POST /api/enquiry logs brief and returns ticket ID', async () => {
    const res = await request({
      method: 'POST',
      path: '/api/enquiry',
      body: {
        name: 'Dr. Jane Smith',
        email: 'dr.jane@aerotech.io',
        company: 'AeroTech Dynamics',
        phase: 'Prototype in progress',
        disc: ['Firmware & RTOS', 'Edge AI & computer vision'],
        scope: 'Developing autonomous navigation stack requiring high-performance RTOS and on-device face recognition.'
      }
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.json.success, true);
    assert.ok(res.json.id.startsWith('#TST-2026-'));
    enquiryTicketId = res.json.id;

    // Verify row in database
    const row = stmts.getEnquiryById.get(enquiryTicketId);
    assert.ok(row, 'Database row should exist');
    assert.strictEqual(row.name, 'Dr. Jane Smith');
    assert.strictEqual(row.company, 'AeroTech Dynamics');
  });

  // 3. Enquiry Validation - Missing Fields
  await test('POST /api/enquiry rejects payload without required scope', async () => {
    const res = await request({
      method: 'POST',
      path: '/api/enquiry',
      body: {
        name: 'Dr. Jane Smith',
        email: 'dr.jane@aerotech.io',
        scope: 'tiny' // Less than 5 chars
      }
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.json.error, 'Validation Error');
  });

  // 4. Honeypot Bot Trap Neutralization & Telemetry
  await test('POST /api/enquiry neutralizes bot submission and logs security incident without inserting enquiry', async () => {
    const res = await request({
      method: 'POST',
      path: '/api/enquiry',
      body: {
        name: 'Spam Bot 3000',
        email: 'bot@spamnetwork.com',
        scope: 'Buy cheap traffic now!',
        _tetra_guard: 'automated_scraping_payload'
      }
    });
    // Honeypot returns silent 200 so bot believes it succeeded
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.id, '#TST-2026-0000');

    // Confirm bot was NOT inserted into enquiries table
    const checkRow = db.prepare('SELECT * FROM enquiries WHERE name = ?').get('Spam Bot 3000');
    assert.strictEqual(checkRow, undefined, 'Honeypot bot submission must never be inserted into enquiries database');

    // Confirm incident logged into security_logs table
    const secLog = db.prepare('SELECT * FROM security_logs WHERE event_type = ? ORDER BY id DESC LIMIT 1').get('HONEYPOT_BOT_TRAPPED');
    assert.ok(secLog, 'Security incident must be logged in security_logs');
    assert.ok(secLog.details.includes('_tetra_guard'));
  });

  // 5. Candidate Application Endpoint - Valid Submission
  await test('POST /api/applications logs candidate profile', async () => {
    const res = await request({
      method: 'POST',
      path: '/api/applications',
      body: {
        name: 'Kavita Rao',
        email: 'kavita.rao@embedded.dev',
        phone: '+91 98840 12345',
        role: 'Embedded Firmware & RTOS Engineer',
        exp: 'Early career (1–3 yrs)',
        link: 'https://github.com/kavita-embedded',
        projects: 'Built multi-task FreeRTOS flight sensor fusion pipeline on ESP32-S3 with SPI IMU and I2C Barometer.'
      }
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.json.success, true);
    assert.ok(res.json.id.startsWith('#APP-2026-'));
    appTicketId = res.json.id;

    // Verify row in database
    const row = stmts.getApplicationById.get(appTicketId);
    assert.ok(row, 'Application database row should exist');
    assert.strictEqual(row.name, 'Kavita Rao');
    assert.strictEqual(row.role, 'Embedded Firmware & RTOS Engineer');
  });

  // 6. Application URL Scheme Defense (Prevent javascript: or data: URIs)
  await test('POST /api/applications rejects javascript: URI in portfolio link', async () => {
    const res = await request({
      method: 'POST',
      path: '/api/applications',
      body: {
        name: 'Sneaky Attacker',
        email: 'attacker@evil.corp',
        phone: '+91 99999 00000',
        role: 'Open Engineering Application',
        exp: 'Senior (6+ yrs)',
        link: 'javascript:alert(document.cookie)',
        projects: 'Exploitation research'
      }
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.json.error, 'Validation Error');
  });

  // 7. Security: Unauthenticated Admin Route Access Blocked
  await test('GET /api/admin/metrics returns 401 without authentication', async () => {
    const res = await request({ method: 'GET', path: '/api/admin/metrics' });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.json.error, 'Unauthorized');
  });

  // 8. Auth: Failed Login with Wrong Password
  await test('POST /api/auth/login rejects invalid password with 401', async () => {
    const res = await request({
      method: 'POST',
      path: '/api/auth/login',
      body: { password: 'WrongPassword123' }
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.json.error, 'Unauthorized');

    // Confirm security audit log recorded
    const failLog = db.prepare('SELECT * FROM security_logs WHERE event_type = ? ORDER BY id DESC LIMIT 1').get('FAILED_ADMIN_LOGIN');
    assert.ok(failLog, 'Failed login must be recorded in security logs');
  });

  // 9. Auth: Successful Login with "TetraSync"
  let sessionCookie = '';
  await test('POST /api/auth/login authenticates with "TetraSync" and sets HttpOnly cookie', async () => {
    const res = await request({
      method: 'POST',
      path: '/api/auth/login',
      body: { password: 'TetraSync' }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.success, true);
    assert.strictEqual(res.json.token, undefined, 'rawToken must never be returned in JSON response body');

    const setCookie = res.headers['set-cookie'];
    assert.ok(setCookie, 'Should provide Set-Cookie header');
    const cookieHeader = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
    assert.ok(cookieHeader.includes('tst_admin_session='), 'Cookie should be named tst_admin_session');
    assert.ok(cookieHeader.includes('HttpOnly'), 'Cookie must be HttpOnly');

    // Extract session token
    const match = cookieHeader.match(/tst_admin_session=([^;]+)/);
    assert.ok(match, 'Must extract session token');
    sessionCookie = `tst_admin_session=${match[1]}`;
  });

  // 9b. Auth: Successful Login with "Pentaryon" Brand Alias
  await test('POST /api/auth/login authenticates with "Pentaryon" brand alias', async () => {
    const res = await request({
      method: 'POST',
      path: '/api/auth/login',
      body: { password: 'Pentaryon' }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.success, true);
  });

  // 10. Admin: Access Metrics with Valid Session
  await test('GET /api/admin/metrics succeeds with authenticated session', async () => {
    const res = await request({
      method: 'GET',
      path: '/api/admin/metrics',
      headers: { Cookie: sessionCookie }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.success, true);
    assert.ok(res.json.enquiries, 'Enquiries count must be returned');
    assert.ok(res.json.applications, 'Applications count must be returned');
    assert.ok(res.json.enquiries.total >= 1);
    assert.ok(res.json.applications.total >= 1);
  });

  // 11. Admin: View Enquiries and Update Status
  await test('PATCH /api/admin/enquiries/:id updates triage workflow', async () => {
    const res = await request({
      method: 'PATCH',
      path: `/api/admin/enquiries/${encodeURIComponent(enquiryTicketId)}`,
      headers: { Cookie: sessionCookie },
      body: { status: 'reviewed' }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.success, true);
    assert.strictEqual(res.json.status, 'reviewed');

    // Confirm in DB
    const row = stmts.getEnquiryById.get(enquiryTicketId);
    assert.strictEqual(row.status, 'reviewed');
  });

  // 12. Security Telemetry Check
  await test('GET /api/admin/security-logs records audit trail', async () => {
    const res = await request({
      method: 'GET',
      path: '/api/admin/security-logs',
      headers: { Cookie: sessionCookie }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.success, true);
    assert.ok(Array.isArray(res.json.data), 'Logs data should be an array');
    assert.ok(res.json.data.length >= 1, 'At least one security log should be recorded');
  });

  // 13. Security: Log Purge Non-Repudiation (Leaves Indelible Audit Ledger Entry)
  await test('DELETE /api/admin/security-logs purges logs but leaves immutable audit trail', async () => {
    const res = await request({
      method: 'DELETE',
      path: '/api/admin/security-logs',
      headers: { Cookie: sessionCookie }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.success, true);

    // Verify non-repudiation log exists in database
    const verifyRes = await request({
      method: 'GET',
      path: '/api/admin/security-logs',
      headers: { Cookie: sessionCookie }
    });
    assert.strictEqual(verifyRes.status, 200);
    assert.ok(verifyRes.json.data.length >= 1, 'Purge action must itself be logged');
    assert.strictEqual(verifyRes.json.data[0].event_type, 'SECURITY_LOGS_PURGED');
  });

  // 14. Network AppSec: Strict CORS Whitelist Verification
  await test('CORS rejects unauthorized origin and accepts trusted domain', async () => {
    // Untrusted origin
    const badRes = await request({
      method: 'GET',
      path: '/api/health',
      headers: { Origin: 'https://evil-hacker.com' }
    });
    assert.strictEqual(badRes.status, 200);
    assert.strictEqual(badRes.headers['access-control-allow-origin'], undefined, 'Untrusted origin must not receive Access-Control-Allow-Origin');

    // Trusted production origin
    const goodRes = await request({
      method: 'GET',
      path: '/api/health',
      headers: { Origin: 'https://tetrasync.tech' }
    });
    assert.strictEqual(goodRes.status, 200);
    assert.strictEqual(goodRes.headers['access-control-allow-origin'], 'https://tetrasync.tech');
    assert.strictEqual(goodRes.headers['access-control-allow-credentials'], 'true');
  });

  // 15. AppSec Headers: CSP unsafe-eval removal & Permissions-Policy
  await test('Security headers enforce strict CSP and Permissions-Policy', async () => {
    const res = await request({ method: 'GET', path: '/' });
    assert.strictEqual(res.status, 200);
    const csp = res.headers['content-security-policy'] || '';
    assert.ok(!csp.includes("'unsafe-eval'"), "CSP must NOT include 'unsafe-eval'");
    assert.ok(res.headers['permissions-policy'], 'Permissions-Policy header must be present');
  });

  // 16. Auth Logout
  await test('POST /api/auth/logout terminates session', async () => {
    const res = await request({
      method: 'POST',
      path: '/api/auth/logout',
      headers: { Cookie: sessionCookie }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.success, true);

    // Verify session revoked
    const testRes = await request({
      method: 'GET',
      path: '/api/admin/metrics',
      headers: { Cookie: sessionCookie }
    });
    assert.strictEqual(testRes.status, 401);
  });

  console.log('\n------------------------------------------------------');
  console.log(`Test Execution Summary: ${passed} Passed, ${failed} Failed`);
  console.log('------------------------------------------------------\n');

  if (failed > 0) {
    process.exitCode = 1;
  }
}

// Start temporary test server
server = app.listen(TEST_PORT, () => {
  serverUrl = `http://localhost:${TEST_PORT}`;
  console.log(`[TEST SUITE] Attached to test server on port ${TEST_PORT}`);
  runTests().finally(() => {
    // Teardown: purge test artifacts so production DB remains 100% clean
    try {
      if (enquiryTicketId) db.prepare('DELETE FROM enquiries WHERE id = ?').run(enquiryTicketId);
      if (appTicketId) db.prepare('DELETE FROM applications WHERE id = ?').run(appTicketId);
      db.prepare("DELETE FROM security_logs WHERE details LIKE '%automated_scraping_payload%' OR details LIKE '%hidden_bot_payload%' OR event_type = 'FAILED_ADMIN_LOGIN'").run();
      db.prepare("DELETE FROM enquiries WHERE email = 'dr.jane@aerotech.io'").run();
      db.prepare("DELETE FROM applications WHERE email = 'kavita.rao@embedded.dev'").run();
    } catch (e) {}

    server.close(() => {
      console.log('[TEST SUITE] Test server stopped cleanly and mock test data was purged.');
      process.exit(process.exitCode || 0);
    });
  });
});
