import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import env from '../../config/env.js';

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
  status, // 'APPROVED' | 'REJECTED'
  rejectionReason = "",
  loginPhone = "",
  requestNumber = "",
}) => {
  if (!to || !to.includes("@") || !isConfigured()) return null;

  const entityLabel =
    entityType === "business" ? "business" : entityType === "contribution_group" ? "contribution group" : "chama";
  const isApproved = String(status).toUpperCase() === "APPROVED";

  const subject = isApproved
    ? `Your ${entityLabel} "${entityName}" is ready`
    : `Update on your ${entityLabel} request "${entityName}"`;

  const text = isApproved
    ? `Good news, ${contactName || "there"}! Your ${entityLabel} "${entityName}" has been reviewed and fully created. You can log in now${
        loginPhone ? ` using ${loginPhone}` : ""
      } to get started. Reference: ${requestNumber || "N/A"}.`
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

export const isEmailChannelConfigured = isConfigured;

export default {
  sendOtpEmail,
  sendBusinessReceiptEmail,
  sendWorkspaceRequestStatusEmail,
  isEmailChannelConfigured,
};
