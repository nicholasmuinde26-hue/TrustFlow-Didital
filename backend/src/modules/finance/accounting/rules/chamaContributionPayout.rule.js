/**
 * ============================================================================
 * CHAMA-INTERNAL CONTRIBUTION — PAYOUT ACCOUNTING RULE
 * ============================================================================
 *
 * Fired once (via accounting.service.js, NOT the payment-event bus) when a
 * treasurer/official disburses an approved ChamaContribution — see
 * modules/chama/chamaContribution.service.js `disburse()`.
 *
 * CHAMA_CONTRIB_PAYOUT_SETTLEMENT:
 *
 *      DR  <the contribution's own fund account>   (liability decreases —
 *          the money is no longer sitting with the chama)
 *      CR  CASH / BANK / MPESA_CLEARING              (asset decreases —
 *          money actually leaves the chama's account)
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

const ASSET_ACCOUNT_BY_METHOD = { cash: "CASH", bank: "BANK", mpesa: "MPESA_CLEARING" };

class ChamaContributionPayoutRule {
  async build(context, session = null) {
    if (context.referenceType && context.referenceType !== "CHAMA_CONTRIB_PAYOUT_SETTLEMENT") {
      throw new Error(`Unsupported chama contribution payout event ${context.referenceType}`);
    }

    const opts = getOpts(session);
    const owner_type = context.owner_type || "Chama";
    const owner_id = context.owner_id || context.chamaId;
    const accountCode = context.metadata?.account_code;

    if (!owner_id) throw new Error("[ChamaContributionPayoutRule] Missing owner_id");
    if (!accountCode) throw new Error("[ChamaContributionPayoutRule] Missing metadata.account_code");

    const fundAccount = await FinancialAccount.findOne({ owner_type, owner_id, account_code: accountCode }, null, opts);
    if (!fundAccount) throw new Error(`Contribution fund account '${accountCode}' not found for chama ${owner_id}`);

    const assetCode = ASSET_ACCOUNT_BY_METHOD[context.disbursement_method || context.metadata?.disbursement_method] || "CASH";
    let assetAccount = await FinancialAccount.findOne({ owner_type, owner_id, account_code: assetCode }, null, opts);
    if (!assetAccount && assetCode === "MPESA_CLEARING") {
      assetAccount = await FinancialAccount.findOne({ owner_type, owner_id, account_code: "BANK" }, null, opts);
    }
    if (!assetAccount) throw new Error(`${assetCode} account not configured for chama ${owner_id}`);

    return {
      transactionType: "CHAMA_CONTRIB_PAYOUT_SETTLEMENT",
      description: context.description || "Chama contribution payout",
      chama: owner_id,
      amount: context.amount,
      currency: context.currency || "KES",
      entries: [
        {
          account_id: fundAccount._id,
          entryType: "DEBIT",
          amount: context.amount,
          description: context.description || "Chama contribution disbursed",
        },
        {
          account_id: assetAccount._id,
          entryType: "CREDIT",
          amount: context.amount,
          description: context.description || "Chama contribution disbursed",
        },
      ],
    };
  }
}

export default new ChamaContributionPayoutRule();
