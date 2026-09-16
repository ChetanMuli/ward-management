const APP_NAME = 'WardDesk';

function truthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && (process.env.SMTP_FROM || process.env.SMTP_USER));
}

function smsConfigured() {
  return Boolean(
    process.env.SMS_WEBHOOK_URL
    || process.env.SMS_API_KEY
    || process.env.FAST2SMS_API_KEY
    || process.env.MSG91_AUTH_KEY
  );
}

function isConfigured() {
  return mailConfigured() || smsConfigured();
}

function digits10(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

let transporterPromise = null;
async function mailer() {
  if (!mailConfigured()) return null;
  if (transporterPromise) return transporterPromise;
  transporterPromise = (async () => {
    let nodemailer;
    try {
      nodemailer = require('nodemailer');
    } catch (err) {
      console.error('[OUTBOUND] nodemailer is not installed. Email delivery is disabled.', err.message);
      return null;
    }
    const port = Number(process.env.SMTP_PORT || 587);
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: truthy(process.env.SMTP_SECURE) || port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
        : undefined,
    });
  })();
  return transporterPromise;
}

async function sendEmail({ to, subject, text }) {
  const address = String(to || '').trim();
  if (!address || !address.includes('@')) return { ok: false, skipped: 'no-email' };
  const transport = await mailer();
  if (!transport) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[OUTBOUND EMAIL] to=${address} subject=${subject}\n${text}`);
    }
    return { ok: false, skipped: 'smtp-not-configured' };
  }
  try {
    await transport.sendMail({
      from: `"${process.env.MAIL_FROM_NAME || APP_NAME}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: address,
      subject,
      text,
    });
    return { ok: true, channel: 'EMAIL' };
  } catch (err) {
    console.error('[OUTBOUND EMAIL FAILURE]', { to: address, subject, error: err.message });
    return { ok: false, error: err.message };
  }
}

async function sendSms({ to, text }) {
  const mobile = digits10(to);
  const body = String(text || '').trim();
  if (!mobile) return { ok: false, skipped: 'no-mobile' };
  if (!smsConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[OUTBOUND SMS] to=${mobile} ${body}`);
    }
    return { ok: false, skipped: 'sms-not-configured' };
  }

  const provider = String(process.env.SMS_PROVIDER || '').toLowerCase();
  const apiKey = process.env.SMS_API_KEY || process.env.FAST2SMS_API_KEY || '';
  try {
    if (process.env.SMS_WEBHOOK_URL) {
      const res = await fetch(process.env.SMS_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.SMS_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN}` } : {}),
        },
        body: JSON.stringify({ to: mobile, message: body, sender: APP_NAME }),
      });
      if (!res.ok) throw new Error(`webhook ${res.status}`);
      return { ok: true, channel: 'SMS' };
    }

    if (provider === 'msg91' || process.env.MSG91_AUTH_KEY) {
      const res = await fetch('https://control.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: {
          authkey: process.env.MSG91_AUTH_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: process.env.MSG91_TEMPLATE_ID,
          sender: process.env.MSG91_SENDER || 'WRDDES',
          short_url: '0',
          recipients: [{ mobiles: `91${mobile}`, VAR1: body.slice(0, 160) }],
        }),
      });
      if (!res.ok) throw new Error(`msg91 ${res.status}`);
      return { ok: true, channel: 'SMS' };
    }

    if (apiKey) {
      const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: process.env.FAST2SMS_ROUTE || 'q',
          sender_id: process.env.SMS_SENDER || 'WardDesk',
          message: body.slice(0, 200),
          language: 'english',
          flash: 0,
          numbers: mobile,
        }),
      });
      if (!res.ok) throw new Error(`fast2sms ${res.status}`);
      return { ok: true, channel: 'SMS' };
    }
  } catch (err) {
    console.error('[OUTBOUND SMS FAILURE]', { to: mobile, error: err.message });
    return { ok: false, error: err.message };
  }
  return { ok: false, skipped: 'sms-not-configured' };
}

async function deliverOtp({ email, otp, name }) {
  const greeting = name ? `Hello ${name},` : 'Hello,';
  const mailText = `${greeting}\n\nYour ${APP_NAME} verification code is ${otp}. It expires in 10 minutes.\n\nIf you did not request this, you can ignore this message.\n`;
  return sendEmail({ to: email, subject: `Your ${APP_NAME} verification code`, text: mailText });
}

async function deliverNotice({ email, mobile, title, message }) {
  const subject = String(title || APP_NAME).trim() || APP_NAME;
  const body = String(message || '').trim();
  const text = `${subject}\n\n${body}\n\n— ${APP_NAME}`;
  const smsText = `${subject}: ${body}`.slice(0, 300);
  const tasks = [];
  if (email) tasks.push(sendEmail({ to: email, subject, text }));
  if (mobile) tasks.push(sendSms({ to: mobile, text: smsText }));
  if (!tasks.length) return [];
  return Promise.all(tasks);
}

module.exports = {
  isConfigured,
  mailConfigured,
  smsConfigured,
  sendEmail,
  sendSms,
  deliverOtp,
  deliverNotice,
};
