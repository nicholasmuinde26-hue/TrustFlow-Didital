import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import env from '../../config/env.js';
import { organizationLabel } from '../../utils/organizationTerminology.js';

// ========================================
// EMAIL OTP & TRANSACTIONAL DELIVERY
// ========================================

const isResendConfigured = () => Boolean(env.smtp.resendApiKey);

const isGmailConfigured = () =>
  Boolean(env.smtp.gmailUser && env.smtp.gmailPass);

const isGenericSmtpConfigured = () =>
  Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);

const isConfigured = () =>
  isResendConfigured() || isGmailConfigured() || isGenericSmtpConfigured();

let resendClient = null;
const getResendClient = () => {
  if (!resendClient) {
    resendClient = new Resend(env.smtp.resendApiKey);
  }
  return resendClient;
};

// ========================================
// NODEMAILER TRANSPORTER (LAZY, SINGLETON)
// ========================================

let transporter = null;

const getTransporter = () => {
  if (!isGmailConfigured() && !isGenericSmtpConfigured()) {
    return null;
  }

  if (!transporter) {
    transporter = isGmailConfigured()
      ? nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: env.smtp.gmailUser,
            pass: env.smtp.gmailPass,
          },
        })
      : nodemailer.createTransport({
          host: env.smtp.host,
          port: env.smtp.port,
          secure: env.smtp.secure,
          auth: {
            user: env.smtp.user,
            pass: env.smtp.pass,
          },
        });
  }

  return transporter;
};

// ========================================
// BUILD OTP EMAIL CONTENT
// ========================================

const buildOtpEmail = (otpCode, expiryMinutes) => ({
  subject: 'Your verification code',
  text: `Your verification code is ${otpCode}. It expires in ${expiryMinutes} minutes. If you did not request this, you can safely ignore this email.`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #111827;">Your verification code</h2>
      <p style="color: #374151; font-size: 15px;">
        Use the code below to continue. It expires in <strong>${expiryMinutes} minutes</strong>.
      </p>
      <p style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #059669; margin: 24px 0;">
        ${otpCode}
      </p>
      <p style="color: #9ca3af; font-size: 12px;">
        If you did not request this code, you can safely ignore this email.
      </p>
    </div>
  `,
});

// ========================================
// SEND VIA RESEND SDK
// ========================================

const sendViaResend = async ({ to, otpCode, expiryMinutes }) => {
  const { subject, text, html } = buildOtpEmail(otpCode, expiryMinutes);

  const fromEmail = env.smtp.resendFromEmail || 'onboarding@resend.dev';
  const fromName = env.smtp.fromName || 'VeriCircle';

  const { data, error } = await getResendClient().emails.send({
    from: `${fromName} <${fromEmail}>`,
    to,
    subject,
    text,
    html,
  });

  if (error) {
    throw new Error(`Resend delivery failed: ${error.message || error}`);
  }

  return data;
};

// ========================================
// SEND VIA NODEMAILER (Gmail / generic SMTP)
// ========================================

const sendViaNodemailer = async ({ to, otpCode, expiryMinutes }) => {
  const client = getTransporter();
  const { subject, text, html } = buildOtpEmail(otpCode, expiryMinutes);

  await client.sendMail({
    from: `"${env.smtp.fromName}" <${env.smtp.fromEmail}>`,
    to,
    subject,
    text,
    html,
  });
};

// ========================================
// SEND OTP EMAIL (public entrypoint)
// ========================================

export const sendOtpEmail = async ({ to, otpCode, expiryMinutes }) => {
  if (!isConfigured()) {
    throw new Error(
      'Email is not configured. Set RESEND_API_KEY, or EMAIL_USER + EMAIL_PASS (Gmail), or SMTP_HOST + SMTP_USER + SMTP_PASS, to enable email OTP delivery.'
    );
  }

  if (isResendConfigured()) {
    await sendViaResend({ to, otpCode, expiryMinutes });
  } else {
    await sendViaNodemailer({ to, otpCode, expiryMinutes });
  }

  return { channel: 'email', to };
};

// ========================================
// SEND BUSINESS RECEIPT EMAIL (Resend)
// ========================================

export const sendBusinessReceiptEmail = async ({
  to,
  customerName,
  businessName,
  amount,
  currency = "KES",
  reference,
  channel = "M-Pesa",
}) => {
  if (!to || !to.includes("@")) return null;

  const subject = `Payment Receipt from ${businessName} - Ref: ${reference || "RECEIPT"}`;
  const text = `Thank you ${customerName || "Valued Customer"} for your payment of ${currency} ${Number(amount).toLocaleString()} to ${businessName}. Receipt Reference: ${reference || "N/A"} via ${channel}. Verified & Secured by VeriCircle-.`;
  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 520px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <div style="background-color: #0f172a; padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 20px; font-weight: 800; tracking-spacing: 0.5px;">${String(businessName).toUpperCase()}</h1>
        <p style="margin: 4px 0 0; font-size: 12px; color: #38bdf8; font-weight: 600;">Official Business Payment Receipt</p>
      </div>
      <div style="padding: 28px;">
        <p style="color: #334155; font-size: 15px; margin-top: 0;">Dear <strong>${customerName || "Valued Customer"}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.5;">
          Thank you for your payment to <strong>${businessName}</strong>. Your transaction has been completed successfully and logged into our official financial ledger.
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 1px;">AMOUNT PAID</div>
          <div style="font-size: 28px; font-weight: 900; color: #059669; font-family: monospace; margin-top: 4px;">${currency} ${Number(amount).toLocaleString()}</div>
          <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 16px 0;" />
          <div style="display: flex; justify-content: space-between; font-size: 13px; color: #334155; margin-bottom: 8px;">
            <span>Payment Channel:</span>
            <strong style="text-transform: uppercase;">${channel}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; color: #334155;">
            <span>Receipt Ref:</span>
            <strong style="font-family: monospace;">${reference || "N/A"}</strong>
          </div>
        </div>

        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; text-align: center; margin-top: 24px;">
          <div style="font-size: 12px; font-weight: 800; color: #166534;">Verified & Secured by VeriCircle-</div>
          <div style="font-size: 11px; color: #15803d; margin-top: 2px;">Authentic Trust-Circle Financial Guarantee</div>
        </div>
      </div>
      <div style="background-color: #f8fafc; border-t: 1px solid #e2e8f0; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8;">
        © ${new Date().getFullYear()} ${businessName}. All rights reserved. Powered by VeriCircle- Financial Engine.
      </div>
    </div>
  `;

  try {
    if (isResendConfigured()) {
      const fromEmail = env.smtp.resendFromEmail || "onboarding@resend.dev";
      const fromName = businessName || env.smtp.fromName || "VeriCircle";
      await getResendClient().emails.send({
        from: `${fromName} <${fromEmail}>`,
        to,
        subject,
        text,
        html,
      });
    } else if (isGmailConfigured() || isGenericSmtpConfigured()) {
      const client = getTransporter();
      await client.sendMail({
        from: `"${businessName}" <${env.smtp.fromEmail}>`,
        to,
        subject,
        text,
        html,
      });
    }
  } catch (err) {
    console.error("sendBusinessReceiptEmail failed:", err);
  }
};

// ========================================
// SEND WORKSPACE REQUEST STATUS EMAIL (Approved / Rejected)
// ========================================

export const sendWorkspaceRequestStatusEmail = async ({
  to,
  contactName,
  entityName,
  entityType = "chama",
  status, // 'APPROVED' | 'UNDER_REVIEW' | 'REJECTED'
  rejectionReason = "",
  loginPhone = "",
  requestNumber = "",
}) => {
  if (!to || !to.includes("@") || !isConfigured()) return null;

  const normalizedEntityType = String(entityType || "chama").toLowerCase();
  const entityLabel = normalizedEntityType === "business" ? "business"
    : normalizedEntityType === "contribution_group" ? "contribution group"
    : normalizedEntityType === "sacco" ? "SACCO"
    : normalizedEntityType === "cooperative" ? "Cooperative"
    : normalizedEntityType === "chama" ? "Chama"
    : organizationLabel("chama", { workspace: normalizedEntityType });
  const isApproved = String(status).toUpperCase() === "APPROVED";
  const isUnderReview = String(status).toUpperCase() === "UNDER_REVIEW";

  const subject = isApproved
    ? `Your ${entityLabel} "${entityName}" is ready`
    : isUnderReview
      ? `More information needed for your ${entityLabel} request`
      : `Update on your ${entityLabel} request "${entityName}"`;

  const text = isApproved
    ? `Good news, ${contactName || "there"}! Your ${entityLabel} "${entityName}" has been reviewed and fully created. You can log in now${
        loginPhone ? ` using ${loginPhone}` : ""
      } to get started. Reference: ${requestNumber || "N/A"}.`
    : isUnderReview
      ? `Hello ${contactName || "there"}, an administrator is reviewing your ${entityLabel} request "${entityName}" and needs more information: ${rejectionReason || "Please sign in and check your request."} Reference: ${requestNumber || "N/A"}.`
      : `Hello ${contactName || "there"}, your request to create the ${entityLabel} "${entityName}" was not approved. Reason: ${
        rejectionReason || "Not specified."
      } You're welcome to submit a new request with the corrected details. Reference: ${requestNumber || "N/A"}.`;

  const html = isApproved
    ? `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
      <div style="background-color: #065f46; padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 18px; font-weight: 800;">You're all set!</h1>
      </div>
      <div style="padding: 24px;">
        <p style="color: #334155; font-size: 14px;">Hi <strong>${contactName || "there"}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Your ${entityLabel} <strong>"${entityName}"</strong> has been reviewed and is now <strong>fully created</strong>.
        </p>
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 16px 0; text-align: center;">
          <div style="font-size: 13px; color: #166534; font-weight: 700;">You can log in now to get started${
            loginPhone ? ` with ${loginPhone}` : ""
          }.</div>
        </div>
        <p style="color: #94a3b8; font-size: 11px;">Reference: ${requestNumber || "N/A"}</p>
      </div>
    </div>`
    : isUnderReview
      ? `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #bfdbfe; border-radius: 16px; overflow: hidden;">
      <div style="background-color: #1d4ed8; padding: 24px; text-align: center; color: #ffffff;"><h1 style="margin: 0; font-size: 18px; font-weight: 800;">More information needed</h1></div>
      <div style="padding: 24px;"><p style="color: #334155; font-size: 14px;">Hi <strong>${contactName || "there"}</strong>,</p><p style="color: #475569; font-size: 14px; line-height: 1.6;">Our team is reviewing your ${entityLabel} request <strong>"${entityName}"</strong> and needs more information:</p><div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 16px; margin: 16px 0; color: #1e3a8a;">${rejectionReason || "Please sign in and check your request."}</div><p style="color: #94a3b8; font-size: 11px;">Reference: ${requestNumber || "N/A"}</p></div>
    </div>`
    : `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
      <div style="background-color: #7f1d1d; padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 18px; font-weight: 800;">Request not approved</h1>
      </div>
      <div style="padding: 24px;">
        <p style="color: #334155; font-size: 14px;">Hi <strong>${contactName || "there"}</strong>,</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Your request to create the ${entityLabel} <strong>"${entityName}"</strong> was not approved.
        </p>
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <div style="font-size: 11px; text-transform: uppercase; color: #991b1b; font-weight: 700;">Reason</div>
          <div style="font-size: 14px; color: #7f1d1d; margin-top: 4px;">${rejectionReason || "Not specified."}</div>
        </div>
        <p style="color: #64748b; font-size: 13px;">You're welcome to submit a new request with the corrected details.</p>
        <p style="color: #94a3b8; font-size: 11px;">Reference: ${requestNumber || "N/A"}</p>
      </div>
    </div>`;

  try {
    if (isResendConfigured()) {
      const fromEmail = env.smtp.resendFromEmail || "onboarding@resend.dev";
      const fromName = env.smtp.fromName || "VeriCircle";
      await getResendClient().emails.send({ from: `${fromName} <${fromEmail}>`, to, subject, text, html });
    } else {
      const client = getTransporter();
      if (!client) return null;
      await client.sendMail({ from: `"${env.smtp.fromName}" <${env.smtp.fromEmail}>`, to, subject, text, html });
    }
    return { channel: "email", to };
  } catch (err) {
    console.error("sendWorkspaceRequestStatusEmail failed:", err);
    return null;
  }
};

// Administrative access changes deserve an out-of-band notice. This is
// deliberately best-effort: a mail outage must never leave access half-updated.
export const sendAdminAccessEmail = async ({ to, name, action, category, reason = '' }) => {
  if (!to || !to.includes('@') || !isConfigured()) return null;
  const actionText = {
    appointed: 'You have been appointed as a platform administrator.',
    rescoped: 'Your platform administrator permissions or workspace have changed.',
    suspended: 'Your platform administrator access has been suspended.',
    reinstated: 'Your platform administrator access has been reinstated.',
    revoked: 'Your platform administrator access has been revoked.',
  }[action] || 'Your platform administrator access has changed.';
  const subject = `Administrative access ${action}`;
  const text = `Hello ${name || 'there'}, ${actionText} Category: ${category || 'N/A'}.${reason ? ` Note: ${reason}` : ''} If this was unexpected, contact the platform owner immediately.`;
  try {
    const fromEmail = env.smtp.resendFromEmail || env.smtp.fromEmail || 'onboarding@resend.dev';
    const fromName = env.smtp.fromName || 'VeriCircle';
    if (isResendConfigured()) await getResendClient().emails.send({ from: `${fromName} <${fromEmail}>`, to, subject, text, html: `<p>${text}</p>` });
    else await getTransporter()?.sendMail({ from: `"${fromName}" <${fromEmail}>`, to, subject, text, html: `<p>${text}</p>` });
    return { channel: 'email', to };
  } catch (error) { console.error('sendAdminAccessEmail failed:', error); return null; }
};

export const sendSecurityAlertEmail = async ({ to, name, title, summary, severity = 'MEDIUM' }) => {
  if (!to || !to.includes('@') || !isConfigured()) return null;
  const subject = `[${severity}] ${title}`;
  const text = `Hello ${name || 'Security Admin'}, ${summary}\n\nOpen the Security Command Center to investigate.`;
  try { const fromEmail = env.smtp.resendFromEmail || env.smtp.fromEmail || 'onboarding@resend.dev'; const fromName = env.smtp.fromName || 'VeriCircle'; if (isResendConfigured()) await getResendClient().emails.send({ from: `${fromName} <${fromEmail}>`, to, subject, text, html: `<p>${text}</p>` }); else await getTransporter()?.sendMail({ from: `"${fromName}" <${fromEmail}>`, to, subject, text, html: `<p>${text}</p>` }); return { channel: 'email', to }; } catch (error) { console.error('sendSecurityAlertEmail failed:', error); return null; }
};

// Generic notification email (alerts, approvals, reminders). Best-effort, like
// the other transactional senders: returns null when email is not configured.
const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const sendNotificationEmail = async ({ to, name, title, message, actionUrl, priority = 'normal' }) => {
  if (!to || !String(to).includes('@')) throw new Error('Email delivery failed: recipient has no email address');
  if (!isConfigured()) throw new Error('Email is not configured on this server.');
  const subject = priority === 'urgent' ? `[Urgent] ${title}` : title;
  const link = actionUrl && /^https?:\/\//i.test(actionUrl) ? actionUrl : null;
  const text = `Hello ${name || 'there'},\n\n${message}${link ? `\n\nOpen: ${link}` : ''}\n\n- ${env.smtp.fromName || 'VeriCircle'}`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto"><h2 style="color:#111827">${escapeHtml(title)}</h2><p style="color:#374151;font-size:15px">${escapeHtml(message)}</p>${link ? `<p><a href="${escapeHtml(link)}" style="background:#059669;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Open</a></p>` : ''}<p style="color:#9ca3af;font-size:12px">You are receiving this because of your notification settings.</p></div>`;
  const fromEmail = env.smtp.resendFromEmail || env.smtp.fromEmail || 'onboarding@resend.dev';
  const fromName = env.smtp.fromName || 'VeriCircle';
  if (isResendConfigured()) {
    const { error } = await getResendClient().emails.send({ from: `${fromName} <${fromEmail}>`, to, subject, text, html });
    if (error) throw new Error(`Email delivery failed: ${error.message || error}`);
  } else {
    await getTransporter().sendMail({ from: `"${fromName}" <${fromEmail}>`, to, subject, text, html });
  }
  return { channel: 'email', to };
};

export const sendPublicGivingReceiptEmail = async ({ to, name, amount, causeName, reference }) => {
  if (!to || !String(to).includes('@')) throw new Error('A valid receipt email is required.');
  if (!isConfigured()) throw new Error('Email is not configured on this server.');
  const subject = 'Your GiveTogether donation receipt';
  const text = `Hello ${name || 'there'},\n\nWe received your KES ${amount} donation to ${causeName}. Payment reference: ${reference}. Thank you for giving.\n\nGiveTogether`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#22352a"><h2>Your donation receipt</h2><p>Hello ${escapeHtml(name || 'there')},</p><p>We received your <strong>KES ${escapeHtml(amount)}</strong> donation to <strong>${escapeHtml(causeName)}</strong>.</p><p>Payment reference: ${escapeHtml(reference)}</p><p>Thank you for giving.<br/>GiveTogether</p></div>`;
  const fromEmail = env.smtp.resendFromEmail || env.smtp.fromEmail || 'onboarding@resend.dev';
  const fromName = env.smtp.fromName || 'GiveTogether';
  if (isResendConfigured()) {
    const { error } = await getResendClient().emails.send({ from: `${fromName} <${fromEmail}>`, to, subject, text, html });
    if (error) throw new Error(`Email delivery failed: ${error.message || error}`);
  } else {
    await getTransporter().sendMail({ from: `"${fromName}" <${fromEmail}>`, to, subject, text, html });
  }
  return { channel: 'email', to };
};

export const isEmailChannelConfigured = isConfigured;

export default {
  sendOtpEmail,
  sendBusinessReceiptEmail,
  sendWorkspaceRequestStatusEmail,
  sendAdminAccessEmail,
  sendSecurityAlertEmail,
  sendNotificationEmail,
  isEmailChannelConfigured,
};
