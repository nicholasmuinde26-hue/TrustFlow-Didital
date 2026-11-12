import FinancialAccount from '../../../../models/FinancialAccount.js';
import BurialCase from '../../../../models/BurialCase.js';

const money = (value) => Number(value?.toString?.() ?? value ?? 0);

class BurialBenefitRule {
  async build(context, session = null) {
    const ownerId = context.owner_id || context.chamaId;
    const amount = money(context.amount);
    if (!ownerId || !context.caseId || !Number.isFinite(amount) || amount <= 0) throw new Error('Burial payout requires a chama, case and positive amount');
    const caseRecord = await BurialCase.findOne({ _id: context.caseId, chama_id: ownerId }).session(session || null);
    if (!caseRecord) throw new Error('Burial case not found in this chama');
    const allocations = context.fundAllocations || [];
    const allocated = allocations.reduce((sum, item) => sum + money(item.amount), 0);
    if (Math.abs(allocated - amount) > 0.01) throw new Error('Burial fund allocations must equal the payout amount');
    const accountIds = allocations.map((item) => item.account_id);
    const fundAccounts = await FinancialAccount.find({ _id: { $in: accountIds }, owner_type: 'Chama', owner_id: ownerId }, null, session ? { session } : {});
    if (fundAccounts.length !== accountIds.length) throw new Error('A burial fund account does not belong to this chama');
    let cash = await FinancialAccount.findOne({ owner_type: 'Chama', owner_id: ownerId, account_code: 'MPESA_CLEARING' }, null, session ? { session } : {});
    if (!cash) cash = await FinancialAccount.findOne({ owner_type: 'Chama', owner_id: ownerId, account_code: 'BANK' }, null, session ? { session } : {});
    if (!cash) throw new Error('M-Pesa clearing account is not configured for this chama');
    const description = context.description || `Burial benefit disbursement for ${caseRecord.case_number}`;
    return {
      transactionType: 'burial_benefit_disbursement', description, chama: ownerId, amount, currency: 'KES',
      entries: [
        ...allocations.map((item) => ({ account_id: item.account_id, entryType: 'DEBIT', amount: item.amount, description })),
        { account_id: cash._id, entryType: 'CREDIT', amount, description },
      ],
      afterPost: async ({ transaction }, txSession) => {
        await BurialCase.updateOne({ _id: caseRecord._id, chama_id: ownerId }, {
          $inc: { 'case_money.benefit_paid': transaction.amount },
          $addToSet: { 'case_money.related_transactions': transaction._id },
        }, txSession ? { session: txSession } : {});
      },
    };
  }
}

export default new BurialBenefitRule();
