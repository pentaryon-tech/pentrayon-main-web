/**
 * Pentaryon Technology - Automated Notification Mailer
 * Protected against SMTP Header Injection & Stored XSS.
 */
'use strict';

const nodemailer = require('nodemailer');
const config = require('./config');
const { escapeHtml, cleanHeaderString } = require('./security');

let transporter = null;

if (config.smtp.isConfigured) {
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass
    }
  });
}

/**
 * Format executive dark-themed HTML email template
 */
function wrapEmailTemplate(title, preheader, bodyContent) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin: 0; padding: 0; background-color: #090C10; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #E6EDF6; }
    .container { max-width: 600px; margin: 30px auto; background-color: #0E131F; border: 1px solid rgba(0, 210, 255, 0.25); border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #090C10 0%, #121824 100%); padding: 24px 32px; border-bottom: 1px solid rgba(148, 170, 200, 0.15); }
    .logo-text { font-size: 20px; font-weight: 700; letter-spacing: 0.1em; color: #FFFFFF; }
    .logo-sync { color: #00D2FF; font-weight: 800; }
    .content { padding: 32px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; background: rgba(0, 210, 255, 0.12); color: #00D2FF; border: 1px solid rgba(0, 210, 255, 0.3); margin-bottom: 12px; }
    .title { font-size: 22px; font-weight: 700; margin: 0 0 16px; color: #FFFFFF; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
    th { text-align: left; padding: 10px 12px; color: #9AA7BB; border-bottom: 1px solid rgba(148, 170, 200, 0.15); width: 35%; font-weight: 500; }
    td { padding: 10px 12px; color: #FFFFFF; border-bottom: 1px solid rgba(148, 170, 200, 0.15); }
    .code-box { background: #06090E; border: 1px solid rgba(148, 170, 200, 0.2); border-radius: 8px; padding: 14px; font-family: Consolas, Monaco, monospace; font-size: 13px; line-height: 1.6; color: #C6D1E1; white-space: pre-wrap; word-break: break-word; }
    .footer { padding: 20px 32px; background: #06090E; border-top: 1px solid rgba(148, 170, 200, 0.12); font-size: 12px; color: #6B788D; text-align: center; }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${escapeHtml(preheader)}
  </div>
  <div class="container">
    <div class="header">
      <span class="logo-text">PENTA<span class="logo-sync">RYON</span></span>
      <span style="font-size: 10px; font-family: monospace; letter-spacing: 0.2em; color: #9AA7BB; margin-left: 8px;">TECHNOLOGY</span>
    </div>
    <div class="content">
      ${bodyContent}
    </div>
    <div class="footer">
      Pentaryon Technology &bull; Synchronizing Silicon &amp; Code<br>
      Automated Secure Dispatch System
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Dispatch Technical Brief Notification
 */
async function sendEnquiryNotification(enquiry) {
  const safeId = cleanHeaderString(enquiry.id);
  const safeCompany = cleanHeaderString(enquiry.company || 'Direct Client');
  const safeName = cleanHeaderString(enquiry.name);
  const safeEmail = cleanHeaderString(enquiry.email);
  const safePhase = cleanHeaderString(enquiry.phase || 'Specification');

  const subject = `[Pentaryon Brief] ${safeId} - ${safeCompany} (${safeName})`;
  const preheader = `New Technical Brief from ${safeName} (${safeCompany}) for evaluation.`;

  const disciplines = Array.isArray(enquiry.disciplines)
    ? enquiry.disciplines.join(', ')
    : String(enquiry.disciplines || 'Not specified');

  const html = wrapEmailTemplate(
    'New Project Technical Brief',
    preheader,
    `
      <span class="badge">Project Brief &bull; ${escapeHtml(safeId)}</span>
      <h1 class="title">New Project Technical Brief</h1>
      <table>
        <tr><th>Reference Ticket</th><td><strong>${escapeHtml(safeId)}</strong></td></tr>
        <tr><th>Client Name</th><td>${escapeHtml(safeName)}</td></tr>
        <tr><th>Email Address</th><td><a href="mailto:${escapeHtml(safeEmail)}" style="color:#00D2FF">${escapeHtml(safeEmail)}</a></td></tr>
        <tr><th>Company / Org</th><td>${escapeHtml(safeCompany)}</td></tr>
        <tr><th>Project Phase</th><td>${escapeHtml(safePhase)}</td></tr>
        <tr><th>Disciplines</th><td>${escapeHtml(disciplines)}</td></tr>
        <tr><th>Submitted At</th><td>${escapeHtml(new Date().toLocaleString())}</td></tr>
      </table>
      <p style="font-size: 13px; color: #9AA7BB; margin-bottom: 8px; font-weight: 600;">Requirements &amp; Scope:</p>
      <div class="code-box">${escapeHtml(enquiry.scope)}</div>
    `
  );

  return deliverEmail({
    to: config.recipientEmail,
    subject,
    html,
    text: `New Technical Brief ${safeId}\nClient: ${safeName} (${safeCompany})\nEmail: ${safeEmail}\nPhase: ${safePhase}\nScope: ${enquiry.scope}`
  });
}

/**
 * Dispatch Candidate Application Notification
 */
async function sendApplicationNotification(app) {
  const safeId = cleanHeaderString(app.id);
  const safeRole = cleanHeaderString(app.role);
  const safeName = cleanHeaderString(app.name);
  const safeEmail = cleanHeaderString(app.email);
  const safePhone = cleanHeaderString(app.phone);

  const subject = `[Pentaryon Careers] ${safeId} - Application: ${safeRole} (${safeName})`;
  const preheader = `Candidate Application from ${safeName} for ${safeRole}.`;

  const html = wrapEmailTemplate(
    'New Candidate Application',
    preheader,
    `
      <span class="badge">Candidate Application &bull; ${escapeHtml(safeId)}</span>
      <h1 class="title">New Engineering Application</h1>
      <table>
        <tr><th>Applicant ID</th><td><strong>${escapeHtml(safeId)}</strong></td></tr>
        <tr><th>Candidate Name</th><td>${escapeHtml(safeName)}</td></tr>
        <tr><th>Email Address</th><td><a href="mailto:${escapeHtml(safeEmail)}" style="color:#00D2FF">${escapeHtml(safeEmail)}</a></td></tr>
        <tr><th>Phone Number</th><td>${escapeHtml(safePhone)}</td></tr>
        <tr><th>Target Role</th><td><strong>${escapeHtml(safeRole)}</strong></td></tr>
        <tr><th>Experience Level</th><td>${escapeHtml(app.experience)}</td></tr>
        ${app.portfolio_link ? `<tr><th>Portfolio / GitHub</th><td><a href="${escapeHtml(app.portfolio_link)}" target="_blank" style="color:#00D2FF">${escapeHtml(app.portfolio_link)}</a></td></tr>` : ''}
        <tr><th>Submitted At</th><td>${escapeHtml(new Date().toLocaleString())}</td></tr>
      </table>
      <p style="font-size: 13px; color: #9AA7BB; margin-bottom: 8px; font-weight: 600;">Notable Technical Projects:</p>
      <div class="code-box">${escapeHtml(app.projects || 'None listed')}</div>
    `
  );

  return deliverEmail({
    to: config.recipientEmail,
    subject,
    html,
    text: `New Application ${safeId}\nName: ${safeName}\nRole: ${safeRole}\nEmail: ${safeEmail}\nPhone: ${safePhone}\nProjects: ${app.projects || 'None'}`
  });
}

/**
 * Core delivery mechanism with fallback logging
 */
async function deliverEmail({ to, subject, html, text }) {
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: `"Pentaryon System" <${config.smtp.user || 'no-reply@pentaryon.tech'}>`,
        to,
        subject,
        html,
        text
      });
      console.log(`[EMAIL DISPATCHED] MessageId: ${info.messageId} -> ${to}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('[EMAIL ERROR] SMTP dispatch failed:', err.message);
      // Fall through to log output so data is never lost
    }
  }

  // Development / Local simulated dispatch logging
  console.log('====================================================');
  console.log(`[SIMULATED EMAIL DISPATCH TO ${to}]`);
  console.log(`Subject: ${subject}`);
  console.log(`Body (Plaintext):\n${text}`);
  console.log('====================================================');
  return { success: true, simulated: true };
}

module.exports = {
  sendEnquiryNotification,
  sendApplicationNotification
};
