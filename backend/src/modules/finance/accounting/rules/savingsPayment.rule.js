/**
 * ============================================================================
 * SAVINGS PAYMENT ACCOUNTING RULE
 * ============================================================================
 *
 * Rule:
 *   DR  Asset account
 *   CR  MEMBER_SAVINGS
 *
 * Used when a member deposits money into their savings wallet.
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

class SavingsPaymentRule {
  name = "SAVINGS_DEPOSIT";

  async resolveAccounts(context = {}, session = null) {
    const opts = getOpts(session);

    const metadata = context?.metadata || {};

    /*
     * =========================================================================
     * RESOLVE OWNER
     * =========================================================================
     *
     * The owner is the Chama that owns the financial accounts.
     *
     * We accept the value from several locations because different parts of
     * the payment pipeline may use different naming conventions.
     */

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
        "[SavingsPaymentRule] Missing owner_id.",
        {
          context,
          metadata,
        }
      );

      throw new Error(
        "owner_id is required for savings deposit"
      );
    }

    /*
     * =========================================================================
     * PAYMENT METHOD
     * =========================================================================
     */

    const paymentMethod =
      metadata?.payment_method ||
      metadata?.paymentMethod ||
      context?.payment_method ||
      context?.paymentMethod ||
      "mpesa";

    /*
     * =========================================================================
     * ASSET ACCOUNT
     * =========================================================================
     */

    const assetAccountCodeMap = {
      cash: "CASH",
      bank: "BANK",
      mpesa: "MPESA_CLEARING",
      mpesa_clearing: "MPESA_CLEARING",
    };

    const assetAccountCode =
      assetAccountCodeMap[paymentMethod] || "MPESA_CLEARING";

    /*
     * =========================================================================
     * FIND ASSET ACCOUNT
     * =========================================================================
     */

    let assetAccount = await FinancialAccount.findOne(
      {
        owner_type,
        owner_id,
        account_code: assetAccountCode,
      },
      null,
      opts
    );

    /*
     * =========================================================================
     * MPESA FALLBACK
     * =========================================================================
     *
     * If MPESA_CLEARING does not exist, temporarily fall back to BANK.
     */

    if (!assetAccount && assetAccountCode === "MPESA_CLEARING") {
      assetAccount = await FinancialAccount.findOne(
        {
          owner_type,
          owner_id,
          account_code: "BANK",
        },
        null,
        opts
      );

      if (assetAccount) {
        console.warn(
          `[SavingsPaymentRule] MPESA_CLEARING not found. ` +
          `Falling back to BANK for owner ${owner_id}`
        );
      }
    }

    /*
     * =========================================================================
     * FIND MEMBER SAVINGS LIABILITY
     * =========================================================================
     */

    let liabilityAccount = await FinancialAccount.findOne(
      {
        owner_type,
        owner_id,
        account_code: "MEMBER_SAVINGS",
      },
      null,
      opts
    );

    /*
     * =========================================================================
     * SELF-HEAL FINANCIAL ACCOUNTS
     * =========================================================================
     */

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
          {
            owner_type,
            owner_id,
            account_code: assetAccountCode,
          },
          null,
          opts
        );
      }

      if (!liabilityAccount) {
        liabilityAccount = await FinancialAccount.findOne(
          {
            owner_type,
            owner_id,
            account_code: "MEMBER_SAVINGS",
          },
          null,
          opts
        );
      }

      /*
       * If MPESA_CLEARING was unavailable even after bootstrap, try BANK.
       */

      if (
        !assetAccount &&
        assetAccountCode === "MPESA_CLEARING"
      ) {
        assetAccount = await FinancialAccount.findOne(
          {
            owner_type,
            owner_id,
            account_code: "BANK",
          },
          null,
          opts
        );
      }
    }

    /*
     * =========================================================================
     * FINAL VALIDATION
     * =========================================================================
     */

    if (!assetAccount) {
      throw new Error(
        `${assetAccountCode} account not configured for ${owner_type}:${owner_id}`
      );
    }

    if (!liabilityAccount) {
      throw new Error(
        `MEMBER_SAVINGS account not configured for ${owner_type}:${owner_id}`
      );
    }

    return {
      debitAccount: assetAccount._id,
      creditAccount: liabilityAccount._id,
      owner_type,
      owner_id,
      assetAccountCode,
      liabilityAccountCode: "MEMBER_SAVINGS",
    };
  }

  async build(event, session = null) {
    /*
     * =========================================================================
     * NORMALIZE EVENT
     * =========================================================================
     */

    const context = event?.context || {};
    const payment = event?.payment || {};

    const metadata = context?.metadata || {};

    /*
     * Resolve accounts using the complete context.
     */

    const accounts = await this.resolveAccounts(
      context,
      session
    );

    /*
     * Resolve amount.
     */

    const amount = Number(payment?.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(
        `Invalid savings deposit amount: ${payment?.amount}`
      );
    }

    /*
     * Resolve reference.
     */

    const reference =
      payment?.reference ||
      context?.reference ||
      context?.display_reference ||
      "SAVINGS-DEPOSIT";

    return {
      transactionType: "SAVINGS_DEPOSIT",

      referenceType: "SAVINGS_DEPOSIT",

      referenceId:
        payment?.paymentId ||
        payment?.paymentIntentId ||
        payment?.reference ||
        reference,

      organization: context?.organization,

      entries: [
        {
          account_id: accounts.debitAccount,
          entryType: "DEBIT",
          amount,
          description: `Savings deposit ${reference}`,
        },

        {
          account_id: accounts.creditAccount,
          entryType: "CREDIT",
          amount,
          description: `Savings deposit ${reference}`,
        },
      ],

      metadata: {
        member:
          metadata?.participant_id ||
          metadata?.participantId ||
          context?.participantId,

        participant_id:
          metadata?.participant_id ||
          metadata?.participantId ||
          context?.participantId,

        contributionPlan:
          metadata?.contribution_plan_id ||
          metadata?.planId ||
          context?.planId,

        plan_id:
          metadata?.contribution_plan_id ||
          metadata?.planId ||
          context?.planId,

        obligation_id:
          metadata?.obligation_id ||
          metadata?.obligationId ||
          context?.obligationId,

        payment_method:
          metadata?.payment_method ||
          metadata?.paymentMethod ||
          context?.payment_method ||
          "mpesa",

        owner_type: accounts.owner_type,

        owner_id: accounts.owner_id,

        productType:
          metadata?.productType ||
          metadata?.product_type ||
          "savings",
      },
    };
  }
}

export default new SavingsPaymentRule();