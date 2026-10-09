import FinancialAccount from "../../../../models/FinancialAccount.js";
import { BUSINESS_FUND_ACCOUNT_BY_METHOD, FUND_SCOPES, PROFIT_WALLET_PAYABLE_CODE, ensureBusinessFundAccount } from "../businessFunds.constants.js";

// Profit is paid to members by M-Pesa (B2C), so it leaves the business fund's M-Pesa account.
const PAYOUT_FUND_CODE = BUSINESS_FUND_ACCOUNT_BY_METHOD.mpesa;

const incomeCode = (assetId) => `ASI_${String(assetId).slice(-10).toUpperCase()}`;

class ChamaProfitDistributionRule {
  async build(context) {
    const ownerId = context.owner_id;
    const amount = Number(context.amount);
    if (!ownerId || !context.assetId || !Number.isFinite(amount) || amount <= 0) throw new Error("Chama, asset, and positive distribution amount are required");
    const income = await FinancialAccount.findOne({ owner_type: "Chama", owner_id: ownerId, account_code: incomeCode(context.assetId) });
    if (!income) throw new Error("Asset income account does not exist; record the business income before distributing profits");
    const walletCredit = context.referenceType === "CHAMA_PROFIT_WALLET_CREDIT_POSTING";
    const walletWithdrawal = context.referenceType === "CHAMA_PROFIT_WALLET_WITHDRAWAL_POSTING";
    // Profit comes out of the BUSINESS FUND. It never touches the pooled chama accounts.
    const accountCode = walletCredit || walletWithdrawal ? PROFIT_WALLET_PAYABLE_CODE : PAYOUT_FUND_CODE;
    let account;
    if (walletCredit || walletWithdrawal) {
      account = await FinancialAccount.findOne({ owner_type: "Chama", owner_id: ownerId, account_code: accountCode });
      if (!account) {
        [account] = await FinancialAccount.create([{ owner_type: "Chama", owner_id: ownerId, name: "Business Profit Wallet Payable", account_code: accountCode, account_type: "liability", normal_balance: "credit", account_category: "other", fund_scope: FUND_SCOPES.BUSINESS, created_by: context.recordedBy || null }]);
      } else if (account.fund_scope !== FUND_SCOPES.BUSINESS) {
        await FinancialAccount.updateOne({ _id: account._id }, { $set: { fund_scope: FUND_SCOPES.BUSINESS } });
      }
    } else {
      account = await ensureBusinessFundAccount(FinancialAccount, { owner_type: "Chama", owner_id: ownerId, code: accountCode, createdBy: context.recordedBy || null });
    }
    let mpesa = null;
    if (walletWithdrawal) {
      mpesa = await ensureBusinessFundAccount(FinancialAccount, { owner_type: "Chama", owner_id: ownerId, code: PAYOUT_FUND_CODE, createdBy: context.recordedBy || null });
    }
    if (!account) throw new Error("Business fund account is not configured for this Chama");
    return {
      transactionType: walletCredit ? "chama_profit_wallet_credit" : walletWithdrawal ? "chama_profit_wallet_withdrawal" : "chama_profit_distribution",
      description: context.description || "Chama business profit distribution",
      chama: ownerId,
      amount,
      currency: context.currency || "KES",
      entries: walletWithdrawal
        ? [
            { account_id: account._id, entryType: "DEBIT", amount, description: "Profit wallet payable settled" },
            { account_id: mpesa?._id, entryType: "CREDIT", amount, description: "M-Pesa profit wallet withdrawal" },
          ]
        : [
            { account_id: income._id, entryType: "DEBIT", amount, description: "Business profit distributed" },
            { account_id: account._id, entryType: "CREDIT", amount, description: walletCredit ? "Member profit wallet balance credited" : "Profit paid to member by M-Pesa from the business fund" },
          ],
    };
  }
}

export default new ChamaProfitDistributionRule();
