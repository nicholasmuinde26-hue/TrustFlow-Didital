/**
 * ============================================================================
 * CHAMA-INTERNAL CONTRIBUTION — FUNDING ACCOUNTING RULE
 * ============================================================================
 *
 * Posted whenever a member chips into an ad-hoc, cause-based
 * ChamaContribution (emergency / wedding / purchase / etc — see
 * models/ChamaContribution.js). This is deliberately a SEPARATE rule from
 * ContributionPaymentRule (which credits the Chama's general
 * MEMBER_CONTRIBUTIONS account for the fixed/scheduled ContributionPlan):
 *
 *      DR  CASH / BANK / MPESA_CLEARING   (asset increases)
 *      CR  <this contribution's own fund account>   (liability increases —
 *          the Chama now holds this money on behalf of the cause, until
 *          it is disbursed via chamaContributionPayout.rule.js)
 *
 * Each ChamaContribution gets its own FinancialAccount, keyed by a
 * deterministic account_code (see accountCodeForContribution below), so its
 * balance is trackable independently of the chama's other money.
 *
 * ============================================================================
 */

import mongoose from "mongoose";
import FinancialAccount from "../../../../models/FinancialAccount.js";

const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === "ReplicaSetWithPrimary" || topology?.description?.type === "Sharded";
};
const getOpts = (session) => (canUseTransactions() && session ? { session } : {});

export const accountCodeForContribution = (contributionId) =>
  `CC${String(contributionId).slice(-10).toUpperCase()}`;

// The reference is generated as `CHAMA-CC-<accountCode>-<timestamp>-<rand>`
// (see chamaContribution.service.js generateUniqueReference calls). Unlike
// metadata - which depends on it surviving a save/reload round-trip through
// the payment pipeline - `reference` is a required, unique, always-persisted
// field on both PaymentIntent and ContributionPayment, and is always present
// on event.payment.reference. Parsing it here makes account resolution
// robust even if metadata is ever lost or malformed upstream.
const REFERENCE_ACCOUNT_CODE_PATTERN = /^CHAMA-CC-(CC[0-9A-F]{10})-/;

export const parseAccountCodeFromReference = (reference) => {
  const match = REFERENCE_ACCOUNT_CODE_PATTERN.exec(String(reference || ""));
  return match ? match[1] : null;
};

class ChamaContributionRule {
  name = "CHAMA_CONTRIBUTION_PAYMENT";

  async resolveAccounts(event, session = null) {
    const opts = getOpts(session);

    const context = event.context || {};
    const contextMeta = context.metadata || {};
    // Custom fields we attach (chama_contribution_id, account_code, title)
    // travel on the payment record itself (event.payment.metadata) when
    // available, but we no longer REQUIRE them - see reference parsing below.
    const paymentMeta = event.payment?.metadata || {};

    const owner_type = context.owner_type || paymentMeta.owner_type || "Chama";
    const owner_id = context.chamaId || context.owner_id || paymentMeta.chamaId;

    if (!owner_id) {
      throw new Error("[ChamaContributionRule] Missing chama owner_id for contribution payment");
    }

    const contributionId = paymentMeta.chama_contribution_id || contextMeta.chama_contribution_id || null;

    const accountCode =
      parseAccountCodeFromReference(event.payment?.reference) ||
      paymentMeta.account_code ||
      (contributionId ? accountCodeForContribution(contributionId) : null);

    if (!accountCode) {
      throw new Error(
        `[ChamaContributionRule] Could not resolve a contribution account_code for payment ${event.payment?.reference}`
      );
    }

    const title = paymentMeta.contribution_title || "Chama Contribution";

    const paymentMethod = event.payment?.payment_method || paymentMeta.payment_method || contextMeta.payment_method || "cash";
    const assetAccountCodeMap = { cash: "CASH", bank: "BANK", mpesa: "MPESA_CLEARING" };
    let assetAccountCode = assetAccountCodeMap[paymentMethod] || "CASH";

    let assetAccount = await FinancialAccount.findOne(
      { owner_type, owner_id, account_code: assetAccountCode },
      null,
      opts
    );

    if (!assetAccount && assetAccountCode === "MPESA_CLEARING") {
      assetAccount = await FinancialAccount.findOne({ owner_type, owner_id, account_code: "BANK" }, null, opts);
    }

    if (!assetAccount) {
      await FinancialAccount.bootstrapSystemAccounts({ owner_type, owner_id, created_by: paymentMeta.actorId || null }, session);
      assetAccount = await FinancialAccount.findOne({ owner_type, owner_id, account_code: assetAccountCode }, null, opts);
    }

    if (!assetAccount) {
      throw new Error(`${assetAccountCode} account not configured for chama ${owner_id}`);
    }

    // Find-or-create the dedicated per-contribution fund account. Not a
    // "system" account (bootstrapSystemAccounts doesn't know about it), so
    // we create it directly here the first time a payment lands.
    let fundAccount = await FinancialAccount.findOne({ owner_type, owner_id, account_code: accountCode }, null, opts);

    if (!fundAccount) {
      const [created] = await FinancialAccount.create(
        [
          {
            owner_type,
            owner_id,
            name: `Contribution Fund — ${title}`.slice(0, 100),
            account_code: accountCode,
            account_type: "liability",
            normal_balance: "credit",
            account_category: "welfare",
            description: `Ad-hoc chama contribution fund for "${title}"`.slice(0, 500),
          },
        ],
        opts
      );
      fundAccount = created;
    }

    return {
      debitAccount: assetAccount._id,
      creditAccount: fundAccount._id,
      fundAccountId: fundAccount._id,
      contributionId,
      accountCode,
    };
  }

  async build(event, session = null) {
    const accounts = await this.resolveAccounts(event, session);

    return {
      transactionType: "CHAMA_CONTRIBUTION_PAYMENT",
      referenceType: "CHAMA_CONTRIBUTION_PAYMENT",
      referenceId: event.payment.reference,
      entries: [
        {
          account_id: accounts.debitAccount,
          entryType: "DEBIT",
          amount: event.payment.amount,
          description: `Chama contribution payment ${event.payment.reference}`,
        },
        {
          account_id: accounts.creditAccount,
          entryType: "CREDIT",
          amount: event.payment.amount,
          description: `Chama contribution payment ${event.payment.reference}`,
        },
      ],
      metadata: {
        chama_contribution_id: accounts.contributionId,
        account_code: accounts.accountCode,
        financial_account_id: accounts.fundAccountId,
        member: event.context?.participantId,
        payment_method: event.payment?.metadata?.payment_method,
        owner_type: "Chama",
        owner_id: event.context?.chamaId || event.context?.owner_id,
      },
    };
  }
}

export default new ChamaContributionRule();