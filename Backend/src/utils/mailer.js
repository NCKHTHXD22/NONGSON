const nodemailer = require('nodemailer');
const CONFIG = require('../config');

let transporter = null;

function getTransporter() {
  if (!CONFIG.EMAIL_ADMIN || !CONFIG.EMAIL_ADMIN_PASSWORD) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: CONFIG.EMAIL_ADMIN, pass: CONFIG.EMAIL_ADMIN_PASSWORD },
    });
  }
  return transporter;
}

async function sendMail({ to, subject, html }) {
  if (!to) return;
  const t = getTransporter();
  if (!t) {
    console.warn(`[mailer] EMAIL_ADMIN chưa được cấu hình — bỏ qua gửi email tới ${to}`);
    return;
  }
  try {
    await t.sendMail({ from: `"UBND Xã Nông Sơn" <${CONFIG.EMAIL_ADMIN}>`, to, subject, html });
  } catch (err) {
    console.error('[mailer] Gửi email thất bại:', err.message);
  }
}

function buildFeedbackEmailHtml({ heading, feedback, shortCode }) {
  const dashboardBase = CONFIG.DASHBOARD_URL || `${CONFIG.PUBLIC_URL}/app`;
  const link = `${dashboardBase}/feedbacks/${feedback._id}`;
  return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#1A2340;">
      <h2 style="color:#047857;margin-bottom:4px;">${heading}</h2>
      <p style="margin:4px 0;"><b>Mã hồ sơ:</b> #${shortCode}</p>
      <p style="margin:4px 0;"><b>Loại phản ánh:</b> ${feedback.categoryId?.name || '—'}</p>
      <p style="margin:4px 0;"><b>Nội dung:</b> ${feedback.content || ''}</p>
      <a href="${link}" style="display:inline-block;margin-top:14px;padding:10px 18px;background:#059669;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
        Mở hồ sơ trong hệ thống
      </a>
      <p style="margin-top:18px;font-size:12px;color:#94A3B8;">Email tự động từ hệ thống Góp ý – Phản ánh UBND Xã Nông Sơn.</p>
    </div>`;
}

module.exports = { sendMail, buildFeedbackEmailHtml };
