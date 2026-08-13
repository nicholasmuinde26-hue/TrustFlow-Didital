/**
 * ============================================================================
 * MERRY-GO-ROUND (MGR) CONTRIBUTION ACCOUNTING RULE
 * ============================================================================
 *
 * Rule:
 *   DR  Asset account (CASH / BANK / MPESA_CLEARING)
 *   CR  PAYOUT_CLEARING (liability — pooled money owed to whoever's turn
 *       it is to receive this round's payout)
 *
 * Used whenever a member's MGR contribution is recorded as paid — whether
 * via M-Pesa STK push or a treasurer manually marking it paid (cash/bank).
 *
 * Modeled closely on savingsPayment.rule.js's owner-resolution logic, which
 * is the one rule in this file that's been confirmed working end-to-end.
 */

import mongoose from "mongoose";
import FinancialAccount from "../../../../models/FinancialAccount.js";

const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  const topologyType = topology?.description?.type;

  return (
    topologyType === "ReplicaSetWithPrimary" ||
    topologyType === "Sharded"
  );
};

const getOpts = (session) =>
  canUseTransactions() && session ? { session } : {};

class MgrContributionRule {
  name = "MGR_CONTRIBUTION";

  async resolveAccounts(context = {}, session = null) {
    const opts = getOpts(session);

    const metadata = context?.metadata || {};

    const owner_type =
      context?.owner_type ||
      context?.ownerType ||
      metadata?.owner_type ||
      metadata?.ownerType ||
      "Chama";

    const owner_id =
      context?.owner_id ||
      context?.ownerId ||
      context?.chamaId ||
      context?.chama_id ||
      metadata?.owner_id ||
      metadata?.ownerId ||
      metadata?.chamaId ||
      metadata?.chama_id;

    if (!owner_id) {
      console.error(
        "[MgrContributionRule] Missing owner_id.",
        { context, metadata }
      );

      throw new Error(
        "owner_id is required for MGR contribution"
      );
    }

    const paymentMethod =
      metadata?.payment_method ||
      metadata?.paymentMethod ||
      context?.payment_method ||
      context?.paymentMethod ||
      "mpesa";

    const assetAccountCodeMap = {
      cash: "CASH",
      bank: "BANK",
      mpesa: "MPESA_CLEARING",
      mpesa_clearing: "MPESA_CLEARING",
    };

    const assetAccountCode =
      assetAccountCodeMap[paymentMethod] || "MPESA_CLEARING";

    let assetAccount = await FinancialAccount.findOne(
      { owner_type, owner_id, account_code: assetAccountCode },
      null,
      opts
    );

    if (!assetAccount && assetAccountCode === "MPESA_CLEARING") {
      assetAccount = await FinancialAccount.findOne(
        { owner_type, owner_id, account_code: "BANK" },
        null,
        opts
      );

      if (assetAccount) {
        console.warn(
          `[MgrContributionRule] MPESA_CLEARING not found. ` +
          `Falling back to BANK for owner ${owner_id}`
        );
      }
    }

    let liabilityAccount = await FinancialAccount.findOne(
      { owner_type, owner_id, account_code: "PAYOUT_CLEARING" },
      null,
      opts
    );

    if (!assetAccount || !liabilityAccount) {
      await FinancialAccount.bootstrapSystemAccounts(
        {
          owner_type,
          owner_id,
          created_by:
            context?.created_by ||
            context?.actorId ||
            metadata?.created_by ||
            metadata?.actorId,
        },
        session
      );

      if (!assetAccount) {
        assetAccount = await FinancialAccount.findOne(
          { owner_type, owner_id, account_code: assetAccountCode },
          null,
          opts
        );
      }

      if (!liabilityAccount) {
        liabilityAccount = await FinancialAccount.findOne(
          { owner_type, owner_id, account_code: "PAYOUT_CLEARING" },
          null,
          opts
        );
      }

      if (!assetAccount && assetAccountCode === "MPESA_CLEARING") {
        assetAccount = await FinancialAccount.findOne(
          { owner_type, owner_id, account_code: "BANK" },
          null,
          opts
        );
      }
    }

    if (!assetAccount) {
      throw new Error(
        `${assetAccountCode} account not configured for ${owner_type}:${owner_id}`
      );
    }

    if (!liabilityAccount) {
      throw new Error(
        `PAYOUT_CLEARING account not configured for ${owner_type}:${owner_id}`
      );
    }

    return {
      debitAccount: assetAccount._id,
      creditAccount: liabilityAccount._id,
      owner_type,
      owner_id,
      assetAccountCode,
      liabilityAccountCode: "PAYOUT_CLEARING",
    };
  }

  async build(event, session = null) {
    const context = event?.context || {};
    const payment = event?.payment || {};
    const metadata = event?.metadata || context?.metadata || {};

    const accounts = await this.resolveAccounts(
      { ...context, metadata },
      session
    );

    const amount = Number(payment?.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(
        `Invalid MGR contribution amount: ${payment?.amount}`
      );
    }

    const referenceId =
      payment.reference ||
      event?.correlationId ||
      null;

    return {
      transactionType: "MGR_CONTRIBUTION",
      referenceType: "MGR_CONTRIBUTION",
      referenceId,
      entries: [
        {
          account_id: accounts.debitAccount,
          entryType: "DEBIT",
          amount,
          description: `MGR contribution ${referenceId}`,
        },
        {
          account_id: accounts.creditAccount,
          entryType: "CREDIT",
          amount,
          description: `MGR contribution ${referenceId}`,
        },
      ],
      metadata: {
        member: event?.participant?.memberId || null,
        obligation_id: event?.obligation?.id || null,
        payment_method:
          metadata?.payment_method || metadata?.paymentMethod || null,
      },
    };
  }
}

export default new MgrContributionRule();