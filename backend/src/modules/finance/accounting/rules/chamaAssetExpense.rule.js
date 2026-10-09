import mongoose from "mongoose";
import FinancialAccount from "../../../../models/FinancialAccount.js";
import AssetTransaction from "../../../../models/AssetTransaction.js";
import ChamaAsset from "../../../../models/ChamaAsset.js";
import { BUSINESS_FUND_ACCOUNT_BY_METHOD, FUND_SCOPES, ensureBusinessFundAccount } from "../businessFunds.constants.js";

const canUseTransactions = () => ["ReplicaSetWithPrimary", "Sharded"].includes(mongoose.connection?.client?.topology?.description?.type);
const opts = (session) => canUseTransactions() && session ? { session } : {};
const expenseCode = (id) => `ASE_${String(id).slice(-10).toUpperCase()}`;

class ChamaAssetExpenseRule {
  async build(context, session = null) {
    const owner_id = context.owner_id || context.chamaId;
    if (!owner_id || !context.assetId || !Number(context.amount) || Number(context.amount) <= 0) throw new Error("Valid chama, asset, and positive amount are required");
    const queryOpts = opts(session);
    const owner_type = "Chama";
    let expense = await FinancialAccount.findOne({ owner_type, owner_id, account_code: expenseCode(context.assetId) }, null, queryOpts);
    if (!expense) {
      const created = await FinancialAccount.create([{ owner_type, owner_id, name: `${context.assetName || "Asset"} Expenses`, account_code: expenseCode(context.assetId), account_type: "expense", normal_balance: "debit", account_category: "expense", fund_scope: FUND_SCOPES.BUSINESS, created_by: context.recordedBy || null }], queryOpts);
      expense = created[0];
    } else if (expense.fund_scope !== FUND_SCOPES.BUSINESS) {
      await FinancialAccount.updateOne({ _id: expense._id }, { $set: { fund_scope: FUND_SCOPES.BUSINESS } }, queryOpts);
    }
    // Business and property costs are paid from the BUSINESS FUND, never from the
    // members' pooled CASH / BANK / MPESA_CLEARING accounts. If the fund is short,
    // the balance goes negative and the business statements flag it as overdrawn
    // (the money was already spent in the real world, so the posting is not refused).
    const cashCode = BUSINESS_FUND_ACCOUNT_BY_METHOD[context.collectionMethod] || BUSINESS_FUND_ACCOUNT_BY_METHOD.cash;
    const cash = await ensureBusinessFundAccount(FinancialAccount, { owner_type, owner_id, code: cashCode, createdBy: context.recordedBy || null }, queryOpts);
    return {
      transactionType: "chama_asset_expense", description: context.description || "Chama asset expense", chama: owner_id, amount: context.amount, currency: context.currency || "KES",
      entries: [
        { account_id: expense._id, entryType: "DEBIT", amount: context.amount, description: context.description || "Asset expense" },
        { account_id: cash._id, entryType: "CREDIT", amount: context.amount, description: context.description || "Asset expense paid" },
      ],
      afterPost: async ({ transaction, journal, ledgerEntries }, txSession) => {
        const txOpts = opts(txSession);
        await AssetTransaction.create([{ chama_id: owner_id, asset_id: context.assetId, source_business_transaction_id: context.sourceBusinessTransactionId || null, type: "expense", amount: context.amount, currency: context.currency || "KES", description: context.description || "Asset expense", category: context.category || "other", financial_transaction_id: transaction._id, journal_id: journal._id, ledger_entry_ids: (ledgerEntries || []).map((entry) => entry._id), performed_by: context.recordedBy || null }], txOpts);
        await ChamaAsset.updateOne({ _id: context.assetId, chama_id: owner_id }, { $inc: { "book_value.total_expenses": context.amount, "book_value.net_income": -Number(context.amount) }, $set: { "book_value.last_posted_at": new Date(), "accounting.expense_account_code": expenseCode(context.assetId) } }, txOpts);
      },
    };
  }
}
export default new ChamaAssetExpenseRule();