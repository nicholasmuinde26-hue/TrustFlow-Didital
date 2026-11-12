import { ACCOUNT_CODES, ENTRY_TYPES } from '../accounting.constants.js';
import { resolvePlanLedgerAccount } from '../../../contributionPlan/index.js';

class FineShareoutRule {
  async build(context) {
    const fund = await resolvePlanLedgerAccount(context.plan_id);
    const fundEntry = fund ? { account_id: fund._id } : { accountCode: ACCOUNT_CODES.MEMBER_CONTRIBUTIONS };
    const clearing = { accountCode: ACCOUNT_CODES.PAYOUT_CLEARING };
    const amount = context.amount;
    const metadata = { owner_type: context.owner_type, owner_id: context.owner_id, plan_id: context.plan_id };
    if (context.referenceType === 'FINE_SHAREOUT_OBLIGATION') return {
      transactionType: 'FINE_SHAREOUT_OBLIGATION', description: context.description || 'Fine share-out obligation',
      chama: context.owner_id, member: context.created_by, amount, currency: context.currency || 'KES', metadata,
      entries: [
        { ...fundEntry, entryType: ENTRY_TYPES.DEBIT, amount },
        { ...clearing, entryType: ENTRY_TYPES.CREDIT, amount },
      ],
    };
    if (context.referenceType === 'FINE_SHAREOUT_SETTLEMENT') {
      const assetCode = { cash: ACCOUNT_CODES.CASH, bank: ACCOUNT_CODES.BANK, mpesa: ACCOUNT_CODES.MPESA_CLEARING }[context.disbursement_method || context.metadata?.disbursement_method];
      if (!assetCode) throw new Error('Unsupported fine share-out payment method');
      return {
        transactionType: 'FINE_SHAREOUT_SETTLEMENT', description: context.description || 'Fine share-out settlement',
        chama: context.owner_id, member: context.created_by, amount, currency: context.currency || 'KES', metadata,
        entries: [
          { ...clearing, entryType: ENTRY_TYPES.DEBIT, amount },
          { accountCode: assetCode, entryType: ENTRY_TYPES.CREDIT, amount },
        ],
      };
    }
    if (context.referenceType === 'FINE_SHAREOUT_CANCELLATION') return {
      transactionType: 'FINE_SHAREOUT_CANCELLATION', description: context.description || 'Fine share-out cancellation',
      chama: context.owner_id, member: context.created_by, amount, currency: context.currency || 'KES', metadata,
      entries: [
        { ...clearing, entryType: ENTRY_TYPES.DEBIT, amount },
        { ...fundEntry, entryType: ENTRY_TYPES.CREDIT, amount },
      ],
    };
    throw new Error(`Unsupported fine share-out event ${context.referenceType}`);
  }
}

export default new FineShareoutRule();
