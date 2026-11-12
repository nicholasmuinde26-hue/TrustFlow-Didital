import FinancialAccount from "../../../../models/FinancialAccount.js";
import BurialFundraisingCampaign from "../../../../models/BurialFundraisingCampaign.js";

const methodAccount = { cash: "CASH", mpesa: "MPESA_CLEARING", bank: "BANK" };

class BurialFundraisingRule {
  async build(context, session = null) {
    const ownerId = context.owner_id || context.chamaId;
    const amount = Number(context.amount);
    if (!ownerId || !context.campaignId || !context.contributionId || !Number.isFinite(amount) || amount <= 0) {
      throw new Error("Fundraising receipt requires a chama, campaign, contribution and positive amount");
    }
    const opts = session ? { session } : {};
    const campaign = await BurialFundraisingCampaign.findOne({ _id: context.campaignId, chama_id: ownerId }, null, opts);
    if (!campaign) throw new Error("Fundraising campaign does not belong to this chama");
    const collectionAccount = await FinancialAccount.findOne({
      owner_type: "Chama", owner_id: ownerId, account_code: methodAccount[context.collectionMethod] || methodAccount.cash,
    }, null, opts);
    if (!collectionAccount) throw new Error("Configure the chama cash, bank or M-Pesa account before recording fundraising receipts");
    const code = "BURIAL_HARAMBEE";
    let incomeAccount = await FinancialAccount.findOne({ owner_type: "Chama", owner_id: ownerId, account_code: code }, null, opts);
    if (!incomeAccount) {
      [incomeAccount] = await FinancialAccount.create([{
        owner_type: "Chama", owner_id: ownerId, name: "Burial Harambee Income", account_code: code,
        account_type: "income", normal_balance: "credit", account_category: "welfare",
        description: "Receipts from burial chama fundraising campaigns", created_by: context.recordedBy || null,
      }], opts);
    }
    const description = context.description || `Harambee receipt — ${campaign.title}`;
    return {
      transactionType: "burial_fundraising_receipt", description, chama: ownerId, amount, currency: "KES",
      entries: [
        { account_id: collectionAccount._id, entryType: "DEBIT", amount, description },
        { account_id: incomeAccount._id, entryType: "CREDIT", amount, description },
      ],
      afterPost: async ({ transaction }, txSession) => {
        const updateOpts = txSession ? { session: txSession } : {};
        await BurialFundraisingCampaign.updateOne(
          { _id: context.campaignId, chama_id: ownerId, "contributions._id": context.contributionId },
          { $set: { "contributions.$.status": "posted", "contributions.$.financial_transaction_id": transaction._id }, $inc: { raised_amount: amount } },
          updateOpts,
        );
      },
    };
  }
}

export default new BurialFundraisingRule();
