/**
 * ============================================================================
 * CHAMA ASSET INCOME — ACCOUNTING RULE (v2)
 * ============================================================================
 *
 * FIX (v1 → v2): owner_type was hardcoded to "ContributionGroup". Every
 * other chama financial flow — ChamaContribution, ChamaLoan, MGR,
 * Withdrawal, SavingsShareout — posts against `owner_type: "Chama"` for a
 * chama's own FinancialAccounts. This rule was the one place still
 * pointing at the wrong owner bucket, meaning recorded asset income was
 * landing in (or silently creating) accounts scoped to ContributionGroup
 * rather than the chama's real books — invisible to every other report
 * that reads `owner_type: "Chama"`. Fixed below.
 *
 * Fired when a treasurer/official records income from a chama-owned
 * business or property (see modules/chamaAssets/chamaAsset.service.js
 * `recordIncome()`). Unlike member contributions — which credit a
 * liability, because that money still belongs to individual members —
 * this credits a genuine INCOME account: revenue the chama itself earned.
 *
 * CHAMA_ASSET_INCOME_POSTING (v3 — business money is ring-fenced):
 *
 *      DR  BIZ_CASH / BIZ_BANK / BIZ_MPESA     (asset increases — the money
 *          lands in the BUSINESS FUND, not the pooled chama accounts)
 *      CR  <this asset's own income account>   (income increases — this
 *          asset's earnings, trackable independently of the chama's other
 *          money, exactly like chamaContribution.rule.js does per-cause)
 *
 * v2 -> v3: income used to debit the pooled CASH / BANK / MPESA_CLEARING
 * accounts, which are what the chama balance, loan limits and withdrawal
 * checks read. A shop sale therefore inflated the chama balance even though
 * the money is not members' savings or contributions. Both legs now live in
 * the business fund (see businessFunds.constants.js), so the pooled balance,
 * member savings and contributions are untouched, and the business has its
 * own income statement and balance.
 *
 * The income account is created lazily, per asset, the first time this
 * rule runs for it — mirroring accountCodeForContribution() in
 * chamaContribution.rule.js.
 *
 * After posting, this also writes an AssetTransaction row and bumps
 * ChamaAsset.book_value — both purely denormalized reads of what was
 * just posted, never a second source of truth. See models/AssetTransaction.js.
 *
 * ============================================================================
 */

import mongoose from "mongoose";
import FinancialAccount from "../../../../models/FinancialAccount.js";
import AssetTransaction from "../../../../models/AssetTransaction.js";
import ChamaAsset from "../../../../models/ChamaAsset.js";
import {
  BUSINESS_FUND_ACCOUNT_BY_METHOD,
  FUND_SCOPES,
  ensureBusinessFundAccount,
} from "../businessFunds.constants.js";

const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === "ReplicaSetWithPrimary" || topology?.description?.type === "Sharded";
};
const getOpts = (session) => (canUseTransactions() && session ? { session } : {});

export const accountCodeForChamaAsset = (assetId) =>
  `ASI_${String(assetId).slice(-10).toUpperCase()}`;

class ChamaAssetIncomeRule {
  async build(context, session = null) {
    if (context.referenceType && context.referenceType !== "CHAMA_ASSET_INCOME_POSTING") {
      throw new Error(`Unsupported chama asset income event ${context.referenceType}`);
    }

    const opts = getOpts(session);
    const owner_type = "Chama"; // FIXED — was "ContributionGroup"
    const owner_id = context.owner_id || context.chamaId;
    const assetId = context.assetId;

    if (!owner_id) throw new Error("[ChamaAssetIncomeRule] Missing owner_id (chamaId)");
    if (!assetId) throw new Error("[ChamaAssetIncomeRule] Missing assetId");
    if (!context.amount || Number(context.amount) <= 0) {
      throw new Error("[ChamaAssetIncomeRule] amount must be a positive number");
    }

    // Resolve (or lazily create) this asset's own income account.
    const incomeAccountCode = accountCodeForChamaAsset(assetId);
    let incomeAccount = await FinancialAccount.findOne(
      { owner_type, owner_id, account_code: incomeAccountCode },
      null,
      opts
    );
    if (!incomeAccount) {
      const created = await FinancialAccount.create(
        [
          {
            owner_type,
            owner_id,
            name: context.assetName ? `${context.assetName} Income` : "Chama Asset Income",
            account_code: incomeAccountCode,
            account_type: "income",
            normal_balance: "credit",
            account_category: "income",
            fund_scope: FUND_SCOPES.BUSINESS,
            description: `Income from chama-owned asset ${assetId}`,
            created_by: context.recordedBy || null,
          },
        ],
        opts
      );
      incomeAccount = Array.isArray(created) ? created[0] : created;
    } else if (incomeAccount.fund_scope !== FUND_SCOPES.BUSINESS) {
      await FinancialAccount.updateOne({ _id: incomeAccount._id }, { $set: { fund_scope: FUND_SCOPES.BUSINESS } }, opts);
    }

    // Resolve (or lazily create) the BUSINESS FUND account the income landed
    // in. Never the pooled CASH / BANK / MPESA_CLEARING accounts.
    const assetCode = BUSINESS_FUND_ACCOUNT_BY_METHOD[context.collectionMethod] || BUSINESS_FUND_ACCOUNT_BY_METHOD.cash;
    const assetAccount = await ensureBusinessFundAccount(
      FinancialAccount,
      { owner_type, owner_id, code: assetCode, createdBy: context.recordedBy || null },
      opts
    );

    return {
      transactionType: "chama_asset_income",
      description: context.description || "Chama asset income",
      chama: owner_id,
      amount: context.amount,
      currency: context.currency || "KES",
      entries: [
        {
          account_id: assetAccount._id,
          entryType: "DEBIT",
          amount: context.amount,
          description: context.description || "Asset income received",
        },
        {
          account_id: incomeAccount._id,
          entryType: "CREDIT",
          amount: context.amount,
          description: context.description || "Asset income",
        },
      ],
      // Consumed by accounting.service.js#post AFTER the journal is
      // marked posted — see the afterPost hook wiring below.
      afterPost: async ({ transaction, journal, ledgerEntries }, txSession) => {
        const txOpts = getOpts(txSession);
        await AssetTransaction.create(
          [
            {
              chama_id: owner_id,
              asset_id: assetId,
              source_business_transaction_id: context.sourceBusinessTransactionId || null,
              type: "income",
              amount: context.amount,
              currency: context.currency || "KES",
              description: context.description || "Asset income",
              reconciliation_status: context.reconciliationStatus || "not_applicable",
              mpesa_receipt_number: context.mpesaReceiptNumber || null,
              lease_id: context.leaseId || null,
              lease_period_id: context.leasePeriodId || null,
              financial_transaction_id: transaction._id,
              journal_id: journal._id,
              ledger_entry_ids: (ledgerEntries || []).map((entry) => entry._id),
              performed_by: context.recordedBy || null,
            },
          ],
          txOpts
        );

        await ChamaAsset.updateOne(
          { _id: assetId },
          {
            $inc: { "book_value.total_income": context.amount, "book_value.net_income": context.amount },
            $set: { "book_value.last_posted_at": new Date(), "accounting.income_account_code": incomeAccountCode },
          },
          txOpts
        );
      },
    };
  }
}

export default new ChamaAssetIncomeRule();