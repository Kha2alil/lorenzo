const nodemailer = require('nodemailer');

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env to send emails.');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

async function sendPasswordReset(email, resetToken) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[DEV] Password reset token for ${email}: ${resetToken}`);
    return { sent: false, reset_token: resetToken };
  }

  const fromName = process.env.SMTP_FROM_NAME || 'LORENZO Admin';
  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
  const siteUrl = process.env.SITE_URL || 'http://localhost:3001';

  const resetUrl = `${siteUrl}/admin?reset_token=${resetToken}&email=${encodeURIComponent(email)}`;

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: email,
      subject: 'LORENZO — Password Reset',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#C9A84C">LORENZO</h2>
          <p>You requested a password reset. Click the button below to set a new password:</p>
          <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#1A1A18;color:#F5F0E8;text-decoration:none;border-radius:6px;margin:16px 0">Reset Password</a>
          <p style="color:#8A8478;font-size:12px">This link expires in 15 minutes. If you didn't request this, ignore this email.</p>
        </div>
      `
    });
    return { sent: true };
  } catch (err) {
    console.error('Failed to send email:', err);
    return { sent: false, error: err.message };
  }
}

async function sendOTP(email, otp) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[DEV] OTP for ${email}: ${otp}`);
    return { sent: false, otp };
  }

  const fromName = process.env.SMTP_FROM_NAME || 'LORENZO Admin';
  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: email,
      subject: 'LORENZO — Your OTP Code',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#C9A84C">LORENZO</h2>
          <p>Use the OTP below to reset your admin password:</p>
          <div style="font-size:32px;letter-spacing:6px;text-align:center;padding:20px;background:#EDE7D9;border-radius:6px;margin:16px 0;font-weight:600">${otp}</div>
          <p style="color:#8A8478;font-size:12px">This OTP expires in 15 minutes. If you didn't request this, ignore this email.</p>
        </div>
      `
    });
    return { sent: true };
  } catch (err) {
    console.error('Failed to send OTP email:', err);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendPasswordReset, sendOTP };
