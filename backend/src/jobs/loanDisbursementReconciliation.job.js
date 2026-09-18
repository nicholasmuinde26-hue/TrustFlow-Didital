/**
 * ============================================================================
 * LOAN DISBURSEMENT RECONCILIATION JOB
 * ============================================================================
 * Backstop for M-Pesa B2C loan disbursements. The primary confirmation path
 * is Safaricom calling our /mpesa/b2c/result webhook, which
 * Loandisbursement.service.js#confirmMpesaDisbursement then uses to move the
 * loan from `disbursement_pending` to `active`. If that webhook is ever
 * missed — result URL unreachable, deploy mid-flight, Safaricom retry budget
 * exhausted, etc — the loan is otherwise stuck showing "Processing
 * disbursement..." forever, with nothing re-checking it.
 *
 * This sweep periodically finds such stuck loans and actively asks M-Pesa's
 * Transaction Status API for the real outcome (Safaricom's own docs describe
 * it as "a secondary reconciliation mechanism when Callbacks are not
 * received"). That API is itself asynchronous — this only queues the query;
 * the answer arrives later at /mpesa/transactionstatus/result, which routes
 * back into the same confirmMpesaDisbursement() the primary webhook uses.
 *
 * Deliberately conservative: a loan that's simply mid-flight (younger than
 * MIN_AGE_MS) is left alone — the normal webhook is still likely to land.
 * A loan older than MAX_AGE_MS is flagged for manual review rather than
 * auto-failed/rolled back, because we can't safely assume from here whether
 * the funds already left — auto-retrying a disbursement that actually
 * succeeded would double-pay the member.
 */

import ChamaLoan from "../models/ChamaLoan.js";
import mpesaService from "../payment/providers/mpesa/mpesa.service.js";
import { LOAN_STATUS } from "../modules/loans/Loan.constants.js";
import { createAuditLog, AUDIT_SCOPE_TYPES } from "../services/audit.service.js";
import { AUDIT_ACTIONS } from "../constants/audit.constants.js";

const SWEEP_INTERVAL_MS = Number(process.env.LOAN_DISBURSEMENT_RECONCILE_INTERVAL_MS) || 60_000;
// Give the normal B2C result webhook a fair chance before we start polling.
const MIN_AGE_MS = Number(process.env.LOAN_DISBURSEMENT_RECONCILE_MIN_AGE_MS) || 90_000;
// Past this, stop querying and flag for a human instead.
const MAX_AGE_MS = Number(process.env.LOAN_DISBURSEMENT_RECONCILE_MAX_AGE_MS) || 24 * 60 * 60 * 1000; // 24h
// Don't hammer M-Pesa's status endpoint for a loan we only just queried.
const MIN_RECHECK_INTERVAL_MS = Number(process.env.LOAN_DISBURSEMENT_RECONCILE_RECHECK_MS) || 5 * 60 * 1000; // 5m
const BATCH_SIZE = Number(process.env.LOAN_DISBURSEMENT_RECONCILE_BATCH_SIZE) || 10;

let sweepInProgress = false;

const flagStuck = async (loan) => {
  loan.disbursement.stuck_flagged_at = new Date();
  await loan.save();

  await createAuditLog({
    isSystemGenerated: true,
    scopeType: AUDIT_SCOPE_TYPES.CHAMA,
    chamaId: loan.chama_id,
    action: AUDIT_ACTIONS.LOAN_DISBURSEMENT_NEEDS_REVIEW,
    resourceType: "ChamaLoan",
    resourceId: loan._id,
    after: {
      reason: `Disbursement still "processing" after ${Math.round(MAX_AGE_MS / 3_600_000)}h with no confirmation from M-Pesa — needs manual verification before any retry.`,
      reference: loan.reference,
      provider_reference: loan.disbursement?.provider_reference,
    },
  }).catch(() => null);

  console.warn(`[loan-disbursement-reconcile] Loan ${loan._id} (${loan.reference}) flagged for manual review — stuck past max age.`);
};

const reconcileOne = async (loan) => {
  const originatorConversationId = loan.disbursement?.originator_conversation_id;
  if (!originatorConversationId) {
    // Nothing to query M-Pesa with — can only wait for the webhook or a human.
    return;
  }

  try {
    await mpesaService.queryTransactionStatus({
      originatorConversationId,
      remarks: `Reconcile loan ${loan.reference}`,
      occasion: "Loan disbursement reconciliation",
    });

    loan.disbursement.last_status_check_at = new Date();
    loan.disbursement.status_check_attempts = (loan.disbursement.status_check_attempts || 0) + 1;
    await loan.save();
  } catch (error) {
    console.error(`[loan-disbursement-reconcile] Status query failed for loan ${loan._id}:`, error.message);
  }
};

export const sweepStuckLoanDisbursements = async () => {
  if (sweepInProgress) return;
  sweepInProgress = true;

  try {
    const now = Date.now();
    const recheckCutoff = new Date(now - MIN_AGE_MS);
    const oldestAllowed = new Date(now - MAX_AGE_MS);
    const lastQueriedBefore = new Date(now - MIN_RECHECK_INTERVAL_MS);

    // Anything past MAX_AGE_MS that hasn't already been flagged: hand off to
    // a human instead of continuing to poll indefinitely.
    const overdue = await ChamaLoan.find({
      status: LOAN_STATUS.DISBURSEMENT_PENDING,
      "disbursement.status": "processing",
      "disbursement.provider": "mpesa",
      "disbursement.stuck_flagged_at": null,
      updatedAt: { $lt: oldestAllowed },
    }).limit(BATCH_SIZE);

    for (const loan of overdue) {
      await flagStuck(loan);
    }

    // Everything else in the reconciliation window: still worth actively
    // checking with M-Pesa.
    const candidates = await ChamaLoan.find({
      status: LOAN_STATUS.DISBURSEMENT_PENDING,
      "disbursement.status": "processing",
      "disbursement.provider": "mpesa",
      "disbursement.stuck_flagged_at": null,
      updatedAt: { $lte: recheckCutoff, $gte: oldestAllowed },
      $or: [
        { "disbursement.last_status_check_at": null },
        { "disbursement.last_status_check_at": { $lte: lastQueriedBefore } },
      ],
    })
      .sort({ updatedAt: 1 })
      .limit(BATCH_SIZE);

    if (candidates.length > 0) {
      console.log(`[loan-disbursement-reconcile] Querying M-Pesa transaction status for ${candidates.length} stuck loan disbursement(s).`);
    }

    for (const loan of candidates) {
      await reconcileOne(loan);
      await new Promise((r) => setTimeout(r, 500)); // small backoff, mirrors the STK reconciliation sweep
    }
  } catch (error) {
    console.error("[loan-disbursement-reconcile] Sweep failed:", error.message);
  } finally {
    sweepInProgress = false;
  }
};

export const startLoanDisbursementReconciliationJob = () => {
  console.log(`[loan-disbursement-reconcile] Loan disbursement reconciliation job started (every ${SWEEP_INTERVAL_MS / 1000}s)`);
  const timer = setInterval(sweepStuckLoanDisbursements, SWEEP_INTERVAL_MS);
  timer.unref?.();
  return timer;
};
