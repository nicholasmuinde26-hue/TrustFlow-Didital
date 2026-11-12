import FinancialAccount from "../../../../models/FinancialAccount.js";
import { BurialEquipmentBooking } from "../../../../models/BurialEquipmentHire.js";

const methodAccount = { cash: "CASH", mpesa: "MPESA_CLEARING", bank: "BANK" };

class BurialEquipmentHireRule {
  async build(context, session = null) {
    const ownerId = context.owner_id || context.chamaId;
    const total = Number(context.amount);
    const hireAmount = Number(context.hireAmount);
    const deposit = Number(context.depositAmount || 0);
    if (!ownerId || !context.bookingId || !Number.isFinite(total) || total <= 0 || hireAmount < 0 || deposit < 0 || Math.abs(total - hireAmount - deposit) > 0.01) {
      throw new Error("Equipment hire receipt must have a valid booking, hire charge and deposit");
    }
    const opts = session ? { session } : {};
    const booking = await BurialEquipmentBooking.findOne({ _id: context.bookingId, chama_id: ownerId }, null, opts);
    if (!booking) throw new Error("Equipment booking does not belong to this chama");
    const asset = await FinancialAccount.findOne({ owner_type: "Chama", owner_id: ownerId, account_code: methodAccount[context.collectionMethod] }, null, opts);
    if (!asset) throw new Error("Configure the chama cash, bank or M-Pesa account before recording hire income");
    const resolveAccount = async (code, name, type, category) => {
      let account = await FinancialAccount.findOne({ owner_type: "Chama", owner_id: ownerId, account_code: code }, null, opts);
      if (!account) [account] = await FinancialAccount.create([{
        owner_type: "Chama", owner_id: ownerId, name, account_code: code,
        account_type: type, normal_balance: "credit",
        account_category: category, created_by: context.recordedBy || null,
      }], opts);
      return account;
    };
    const income = hireAmount > 0 ? await resolveAccount("EQUIP_HIRE_INCOME", "Burial Equipment Hire Income", "income", "income") : null;
    const depositPayable = deposit > 0 ? await resolveAccount("EQUIPMENT_DEPOSITS", "Equipment Deposits Payable", "liability", "payable") : null;
    const description = context.description || "Burial chama equipment hire receipt";
    return {
      transactionType: "equipment_hire_payment", description, chama: ownerId, amount: total, currency: "KES",
      entries: [
        { account_id: asset._id, entryType: "DEBIT", amount: total, description },
        ...(hireAmount > 0 ? [{ account_id: income._id, entryType: "CREDIT", amount: hireAmount, description: "Equipment hire income" }] : []),
        ...(deposit > 0 ? [{ account_id: depositPayable._id, entryType: "CREDIT", amount: deposit, description: "Refundable equipment deposit" }] : []),
      ],
      afterPost: async ({ transaction }, txSession) => {
        await BurialEquipmentBooking.updateOne({ _id: booking._id, chama_id: ownerId }, { $set: { financial_transaction_id: transaction._id } }, txSession ? { session: txSession } : {});
      },
    };
  }
}

export default new BurialEquipmentHireRule();
