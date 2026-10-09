/**
 * ============================================================================
 * BUSINESS FUNDS RECLASS — ACCOUNTING RULE
 * ============================================================================
 *
 * One-off move of business and property money that was historically posted
 * into the pooled chama accounts (CASH / BANK / MPESA_CLEARING) into the
 * business fund (BIZ_CASH / BIZ_BANK / BIZ_MPESA). Used only by
 * scripts/separateBusinessFunds.js.
 *
 *   direction "to_business":   DR BIZ_x         CR <pooled x>
 *   direction "to_pooled":     DR <pooled x>    CR BIZ_x        (a negative net)
 *
 * It posts a normal balanced journal, so history is never edited: the pooled
 * account is credited and the business fund debited on the day the migration
 * runs, and the audit trail shows exactly what moved and why.
 * ============================================================================
 */

import FinancialAccount from "../../../../models/FinancialAccount.js";
import {
  POOLED_ACCOUNT_BY_BUSINESS_FUND,
  ensureBusinessFundAccount,
} from "../businessFunds.constants.js";

class BusinessFundsReclassRule {
  async build(context, session = null) {
    const owner_type = "Chama";
    const owner_id = context.owner_id || context.chamaId;
    const fundCode = context.fundAccountCode;
    const pooledCode = POOLED_ACCOUNT_BY_BUSINESS_FUND[fundCode];
    const amount = Number(context.amount);

    if (!owner_id) throw new Error("[BusinessFundsReclass] Missing chama id");
    if (!pooledCode) throw new Error(`[BusinessFundsReclass] Unknown business fund account ${fundCode}`);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("[BusinessFundsReclass] amount must be positive");
    if (!["to_business", "to_pooled"].includes(context.direction)) {
      throw new Error("[BusinessFundsReclass] direction must be to_business or to_pooled");
    }

    const fund = await ensureBusinessFundAccount(FinancialAccount, { owner_type, owner_id, code: fundCode, createdBy: context.recordedBy || null });
    const pooled = await FinancialAccount.findOne({ owner_type, owner_id, account_code: pooledCode });
    if (!pooled) throw new Error(`[BusinessFundsReclass] ${pooledCode} account not found for chama ${owner_id}`);

    const toBusiness = context.direction === "to_business";
    const note = context.description || "Move business and property money out of the pooled chama accounts";
    return {
      transactionType: "business_funds_reclass",
      description: note,
      chama: owner_id,
      amount,
      currency: context.currency || "KES",
      entries: [
        { account_id: (toBusiness ? fund : pooled)._id, entryType: "DEBIT", amount, description: note },
        { account_id: (toBusiness ? pooled : fund)._id, entryType: "CREDIT", amount, description: note },
      ],
    };
  }
}

export default new BusinessFundsReclassRule();
