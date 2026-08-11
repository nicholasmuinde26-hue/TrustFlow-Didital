/**
 * ============================================================================
 * CONTRIBUTION PAYMENT SERVICE - V2: Dumb CRUD, no GL
 * ============================================================================
 */

import mongoose from "mongoose";
import crypto from "node:crypto";
import ContributionPayment from "../../models/ContributionPayment.js";
import contributionObligationService from "./contributionObligation.service.js";
import { toDecimal, isMoneyPositive } from "../../shared/decimal.js";

const PAYMENT_STATUS = { PROCESSING: "pending", COMPLETED: "completed", FAILED: "failed" };
const DEFAULT_CURRENCY = "KES";
const STALE_PENDING_MS = 2 * 60 * 1000; // 2 minutes

const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === "ReplicaSetWithPrimary" || topology?.description?.type === "Sharded";
};
const getOpts = (session) => canUseTransactions() && session? { session } : {};

const generatePaymentReference = (prefix = 'PAY') => {
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${ts}-${rand}`;
};

class ContributionPaymentService {

  async findById(id, session = null) {
    return contributionObligationService.findById(id, session);
  }

  /**
   * Step 1: Create pending payment record. No GL here anymore
   */
  async createPendingPayment(data, session = null) {
    const opts = getOpts(session);

    const obligation = await contributionObligationService.findById(data.obligationId, session);
    if (!obligation) throw new Error("Contribution obligation not found.");
    if (obligation.status === 'paid') throw new Error("Obligation already paid.");

    const paymentMethod = ({ manual: 'cash', cash: 'cash', bank: 'bank', mpesa: 'mpesa' })[String(data.paymentMethod || 'cash').toLowerCase()];
    if (!paymentMethod) throw new Error('Unsupported payment method. Use cash, bank, or mpesa.');

    const amount = toDecimal(data.amount);
    if (!isMoneyPositive(amount)) throw new Error("Payment amount must be greater than zero.");

    // IDEMPOTENCY CHECK
    const idempotencyQuery = {
      obligation_id: obligation._id,
      status: { $ne: PAYMENT_STATUS.FAILED },
      $or: []
    };
    if (data.externalReference) idempotencyQuery.$or.push({ external_reference: data.externalReference });
    if (data.providerPaymentId) idempotencyQuery.$or.push({ provider_payment_id: data.providerPaymentId });
    if (data.idempotencyKey) idempotencyQuery.$or.push({ reference: data.idempotencyKey });
    if (idempotencyQuery.$or.length > 0) {
      const existing = await ContributionPayment.findOne(idempotencyQuery, null, opts);
      if (existing) return { payment: existing, duplicate: true };
    }

    const reference = data.reference || data.idempotencyKey || generatePaymentReference(data.displayReference || 'CONTRIB');

    const [payment] = await ContributionPayment.create([{
        plan_id: obligation.plan_id,
        owner_type: obligation.owner_type,
        owner_id: obligation.owner_id,
        participant_type: obligation.participant_type,
        participant_id: obligation.participant_id,
        obligation_id: obligation._id,
        amount: amount.toString(),
        currency: DEFAULT_CURRENCY,
        payment_method: paymentMethod,
        channel_type: paymentMethod === "bank"? "bank_transfer" : paymentMethod,
        processing_mode: data.processingMode || "manual",
        payment_provider: paymentMethod,
        provider_payment_id: data.providerPaymentId || null,
        external_reference: data.externalReference || null,
        display_reference: data.displayReference || null,
        reference,
        status: PAYMENT_STATUS.PROCESSING,
        created_by: data.createdBy,
        recorded_by: data.createdBy
      }], opts);

    return { payment, duplicate: false };
  }

  /**
   * Step 2: Called AFTER payment.service marks payment COMPLETED and GL is posted
   * Only updates obligation and links the GL transaction
   */
  async completeContributionPayment({ payment, callback }, session = null) {
    const opts = getOpts(session);

    const obligation = await contributionObligationService.findById(payment.obligationId, session);
    if (!obligation) throw new Error("Obligation not found for payment");

    // Find our pending ContributionPayment record
    const contributionPayment = await ContributionPayment.findOne({
      obligation_id: obligation._id,
      reference: payment.idempotencyKey || payment.reference
    }, null, opts);

    if (!contributionPayment) throw new Error("ContributionPayment record not found");

    // Update with GL references from payment.metadata
    contributionPayment.status = PAYMENT_STATUS.COMPLETED;
    contributionPayment.financial_transaction_id = payment.financialTransactionId; // set by pipeline
    contributionPayment.journal_id = payment.journalId;
    contributionPayment.provider_payment_id = callback?.providerData?.MpesaReceiptNumber || payment.providerPaymentId;
    contributionPayment.external_reference = callback?.providerData?.CheckoutRequestID;
    await contributionPayment.save(opts);

    // Close obligation
    await contributionObligationService.markPaid(
      obligation._id,
      toDecimal(contributionPayment.amount),
      payment.financialTransactionId,
      session
    );

    // MGR logic stays here because it's chama business logic, not GL
    if (obligation.owner_type === 'Chama') {
      const { maybeCreateMgrPayoutForChama } = await import('../chama/chamaFinance.service.js');
      await maybeCreateMgrPayoutForChama(String(obligation.owner_id), payment.payerId).catch(() => null);
    }

    return { payment: contributionPayment };
  }

  async markFailed(paymentId, reason, session = null) {
    return ContributionPayment.findByIdAndUpdate(paymentId, { status: PAYMENT_STATUS.FAILED, failureReason: reason }, getOpts(session));
  }
}

export const getOwnerContributionPayments = async ({ owner_type, owner_id, session = null }) => {
  const opts = getOpts(session);
  return ContributionPayment.find({ owner_type, owner_id }, null, opts)
   .populate({ path: "participant_id", select: "role status user_id", populate: { path: "user_id", select: "name phone" }})
   .sort({ createdAt: -1 });
};

export const reconcileContributionObligationPayments = async ({ obligationId, session = null }) => {
  const opts = getOpts(session);
  const payments = await ContributionPayment.find({ obligation_id: obligationId, status: PAYMENT_STATUS.COMPLETED }, null, opts);
  const totalPaid = payments.reduce((sum, payment) => sum.add(toDecimal(payment.amount)), toDecimal(0));
  return { obligationId, totalPaid: totalPaid.toString(), paymentCount: payments.length, payments };
};

export default new ContributionPaymentService();