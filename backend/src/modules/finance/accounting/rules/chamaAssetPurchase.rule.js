import mongoose from "mongoose";
import FinancialAccount from "../../../../models/FinancialAccount.js";
import AssetTransaction from "../../../../models/AssetTransaction.js";
import ChamaAsset from "../../../../models/ChamaAsset.js";

const canUseTransactions = () => ["ReplicaSetWithPrimary", "Sharded"].includes(mongoose.connection?.client?.topology?.description?.type);
const opts = (session) => canUseTransactions() && session ? { session } : {};
const assetCode = (id) => `CHAMA_ASSET_${String(id).slice(-10).toUpperCase()}`;

class ChamaAssetPurchaseRule {
  async build(context, session = null) {
    const owner_id = context.owner_id || context.chamaId;
    const amount = Number(context.amount);
    if (!owner_id || !context.assetId || !Number.isFinite(amount) || amount <= 0) throw new Error("Valid chama, asset, and positive amount are required");
    const owner_type = "Chama";
    const queryOpts = opts(session);
    let assetAccount = await FinancialAccount.findOne({ owner_type, owner_id, account_code: assetCode(context.assetId) }, null, queryOpts);
    if (!assetAccount) {
      const created = await FinancialAccount.create([{ owner_type, owner_id, name: context.assetName || "Chama Asset", account_code: assetCode(context.assetId), account_type: "asset", normal_balance: "debit", account_category: "other", created_by: context.recordedBy || null }], queryOpts);
      assetAccount = created[0];
    }
    let cash = await FinancialAccount.findOne({ owner_type, owner_id, account_code: "CASH" }, null, queryOpts);
    if (!cash) {
      await FinancialAccount.bootstrapSystemAccounts({ owner_type, owner_id, created_by: context.recordedBy || null }, session);
      cash = await FinancialAccount.findOne({ owner_type, owner_id, account_code: "CASH" }, null, queryOpts);
    }
    if (!cash) throw new Error(`CASH account not configured for chama ${owner_id}`);
    return {
      transactionType: "CHAMA_ASSET_PURCHASE_POSTING", description: context.description || "Chama asset acquisition", chama: owner_id, amount, currency: context.currency || "KES",
      entries: [
        { account_id: assetAccount._id, entryType: "DEBIT", amount, description: context.description || "Asset acquired" },
        { account_id: cash._id, entryType: "CREDIT", amount, description: context.description || "Acquisition paid" },
      ],
      afterPost: async ({ transaction, journal, ledgerEntries }, txSession) => {
        const txOpts = opts(txSession);
        await AssetTransaction.create([{ chama_id: owner_id, asset_id: context.assetId, type: "purchase", amount, currency: context.currency || "KES", description: context.description || "Asset acquisition", financial_transaction_id: transaction._id, journal_id: journal._id, ledger_entry_ids: (ledgerEntries || []).map((entry) => entry._id), performed_by: context.recordedBy || null }], txOpts);
        await ChamaAsset.updateOne({ _id: context.assetId, chama_id: owner_id }, { $set: { "accounting.asset_account_code": assetCode(context.assetId), "book_value.last_posted_at": new Date() } }, txOpts);
      },
    };
  }
}
export default new ChamaAssetPurchaseRule();
