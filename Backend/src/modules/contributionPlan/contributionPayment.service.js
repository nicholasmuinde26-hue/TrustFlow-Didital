/**
 * ============================================================================
 * CONTRIBUTION PAYMENT SERVICE
 * ============================================================================
 */

import mongoose from "mongoose";
import crypto from "node:crypto";
import ContributionPayment from "../../models/ContributionPayment.js";
import contributionObligationService from "./contributionObligation.service.js";
import accountingService from "../finance/accounting/accounting.service.js";
import { toDecimal, isMoneyPositive } from "../../shared/decimal.js";

const PAYMENT_STATUS = { PROCESSING: "pending", COMPLETED: "completed", FAILED: "failed" };
const DEFAULT_CURRENCY = "KES";

const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === "ReplicaSetWithPrimary" || topology?.description?.type === "Sharded";
};

const getOpts = (session) => canUseTransactions() && session ? { session } : {};

const generatePaymentReference = (prefix = 'PAY') => {
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${ts}-${rand}`;
};

class ContributionPaymentService {

  async processPayment(data, existingSession = null, _retryWithoutTx = false) {
    const useTx = canUseTransactions();
    let session = useTx ? existingSession || await mongoose.startSession() : null;
    const ownsSession = !existingSession && useTx;

    if (ownsSession && session) session.startTransaction();

    try {
      const opts = getOpts(session);

      const obligation = await contributionObligationService.findById(data.obligationId, session);
      if (!obligation) throw new Error("Contribution obligation not found.");
      if (obligation.status === 'paid') throw new Error("Obligation already paid.");

      const paymentMethod = ({ manual: 'cash', cash: 'cash', bank: 'bank', mpesa: 'mpesa' })[String(data.paymentMethod || 'cash').toLowerCase()];
      if (!paymentMethod) throw new Error('Unsupported payment method. Use cash, bank, or mpesa.');

      const amount = toDecimal(data.amount);
      if (!isMoneyPositive(amount)) throw new Error("Payment amount must be greater than zero.");

      // IDEMPOTENCY CHECK
      const idempotencyCheck = await ContributionPayment.findOne({
        obligation_id: obligation._id,
        provider_payment_id: data.providerPaymentId,
        status: PAYMENT_STATUS.COMPLETED
      }, null, opts);

      if (idempotencyCheck) return { payment: idempotencyCheck, accounting: null, duplicate: true };

      const referencePrefix = data.displayReference || 'CONTRIB';
      const paymentReference = data.reference || generatePaymentReference(referencePrefix);

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
          reference: paymentReference,
          status: PAYMENT_STATUS.PROCESSING,
          created_by: data.createdBy,
          recorded_by: data.createdBy
        }], opts);

      // Accounting - CRITICAL: pass session, service will use getOpts
      const accountingResult = await accountingService.post({
          owner_type: obligation.owner_type,
          owner_id: obligation.owner_id,
          referenceType: "CONTRIBUTION_PAYMENT",
          referenceId: payment._id,
          amount,
          currency: DEFAULT_CURRENCY,
          source_type: "ContributionPayment",
          source_id: payment._id,
          metadata: {
            participant_id: obligation.participant_id,
            obligation_id: obligation._id,
            contribution_plan_id: obligation.plan_id,
            payment_method: paymentMethod
          }
        }, session);

      // Update obligation - FIXED: now sets status to paid + links transaction
      await contributionObligationService.markPaid(
        obligation._id, 
        amount, 
        accountingResult.transactionId, // <-- pass transaction id
        session
      );

      payment.status = PAYMENT_STATUS.COMPLETED;
      payment.financial_transaction_id = accountingResult.transactionId; // <-- link back
      payment.journal_id = accountingResult.journalId;
      await payment.save(opts);

      if (ownsSession && session) await session.commitTransaction();

      if (obligation.owner_type === 'Chama') {
        const { maybeCreateMgrPayoutForChama } = await import('../chama/chamaFinance.service.js');
        await maybeCreateMgrPayoutForChama(String(obligation.owner_id), data.createdBy).catch(() => null);
      }

      return { payment, accounting: accountingResult };

    } catch (error) {
      if (ownsSession && session && session.inTransaction()) {
        try { await session.abortTransaction(); } catch {}
      }

      // Auto retry once without tx if standalone
      if (!_retryWithoutTx && error.code === 20 && error.codeName === 'IllegalOperation') {
        console.warn("MongoDB standalone detected. Retrying processPayment without transactions");
        if (ownsSession && session) { try { await session.endSession(); } catch {} }
        return this.processPayment(data, null, true);
      }

      if (error.code === 11000) throw new Error("Duplicate payment detected. This payment has already been processed.");
      throw error;
    } finally {
      if (ownsSession && session) { try { await session.endSession(); } catch {} }
    }
  }
}

export const getOwnerContributionPayments = async ({ owner_type, owner_id, session = null }) => {
  const opts = getOpts(session);
  return ContributionPayment.find({ owner_type, owner_id }, null, opts)
    .populate({ path: "member_id", select: "role status user_id", populate: { path: "user_id", select: "name phone" }})
    .sort({ createdAt: -1 });
};

export const reconcileContributionObligationPayments = async ({ obligationId, session = null }) => {
  const opts = getOpts(session);
  const payments = await ContributionPayment.find({ obligation_id: obligationId, status: PAYMENT_STATUS.COMPLETED }, null, opts);
  const totalPaid = payments.reduce((sum, payment) => sum.add(toDecimal(payment.amount)), toDecimal(0));
  return { obligationId, totalPaid: totalPaid.toString(), paymentCount: payments.length, payments };
};

export default new ContributionPaymentService();