import {
  processConfirmation,
  manuallyMatchPayment,
  listUnmatchedPayments,
} from './c2bReconciliation.service.js';
import mpesaService from '../../payment/providers/mpesa/mpesa.service.js';

// ============================================================
// VALIDATION URL — SAFARICOM CALLS THIS SYNCHRONOUSLY, PER PAYMENT
// ============================================================
// We accept every payment here. Rejecting real money that's already
// been deducted from a payer's account is far worse than a payment we
// have to reconcile manually — see c2bReconciliation.service.js.
export const handleC2bValidation = async (_req, res) => {
  return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
};

// ============================================================
// CONFIRMATION URL — THE ACTUAL PAYMENT RECORD
// ============================================================
// Safaricom expects a fast 200 (well under its ~8s timeout) and retries
// aggressively otherwise, which is exactly the duplicate-delivery case
// processConfirmation() is built to dedupe. So: respond first, reconcile
// after — never make Safaricom wait on our matching/GL-posting logic.
export const handleC2bConfirmation = async (req, res) => {
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Confirmation received successfully' });

  try {
    await processConfirmation(req.body);
  } catch (error) {
    console.error('[c2b] confirmation processing failed:', error);
  }
};

// ============================================================
// ADMIN — UNMATCHED PAYMENTS QUEUE
// ============================================================
export const getUnmatchedPayments = async (req, res, next) => {
  try {
    const records = await listUnmatchedPayments();
    return res.status(200).json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
};

export const matchPayment = async (req, res, next) => {
  try {
    const { chamaId, memberPhone } = req.body;
    const actorId = req.user?.id || req.user?._id;

    const record = await manuallyMatchPayment({
      c2bPaymentId: req.params.id,
      chamaId,
      memberPhone,
      actorId,
    });

    return res.status(200).json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ADMIN — ONE-TIME REGISTRATION OF VALIDATION/CONFIRMATION URLS
// ============================================================
export const registerUrls = async (req, res, next) => {
  try {
    const { validationURL, confirmationURL, responseType } = req.body;
    const result = await mpesaService.registerC2bUrls({ validationURL, confirmationURL, responseType });
    return res.status(200).json({ success: true, data: result.rawResponse });
  } catch (error) {
    next(error);
  }
};
