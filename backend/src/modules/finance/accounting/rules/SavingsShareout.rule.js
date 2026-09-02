/**
 * ============================================================================
 * SAVINGS SHAREOUT ACCOUNTING RULE
 * ============================================================================
 *
 * Converts savings share-out business events into accounting instructions.
 *
 * This is the "money going back OUT of savings" counterpart to
 * savingsPayment.rule.js (which handles money coming IN as a deposit), and
 * is deliberately its own rule rather than reusing payout.rule.js — an MGR
 * payout draws down MEMBER_CONTRIBUTIONS (the rotational pool), while a
 * savings share-out draws down MEMBER_SAVINGS (each member's own flexible
 * savings balance). Getting that account wrong would misstate both ledgers.
 *
 * Supported events:
 *
 * SAVINGS_SHAREOUT_OBLIGATION   (posted once, for the whole batch)
 *
 *      DR MEMBER_SAVINGS
 *      CR PAYOUT_CLEARING
 *
 * SAVINGS_SHAREOUT_SETTLEMENT   (posted once per item, as each member is paid)
 *
 *      DR PAYOUT_CLEARING
 *      CR CASH/BANK/MPESA
 *
 * SAVINGS_SHAREOUT_CANCELLATION (reverses an unpaid item or an unpaid batch)
 *
 *      DR PAYOUT_CLEARING
 *      CR MEMBER_SAVINGS
 *
 * DOES NOT:
 *
 * ✗ Query FinancialAccount
 * ✗ Modify balances
 * ✗ Create journals
 * ============================================================================
 */

import { ACCOUNT_CODES, ENTRY_TYPES } from '../accounting.constants.js';

class SavingsShareoutRule {
  async build(context) {
    switch (context.referenceType) {
      case 'SAVINGS_SHAREOUT_OBLIGATION':
        return this.buildObligation(context);

      case 'SAVINGS_SHAREOUT_SETTLEMENT':
        return this.buildSettlement(context);

      case 'SAVINGS_SHAREOUT_CANCELLATION':
        return this.buildCancellation(context);

      default:
        throw new Error(`Unsupported savings shareout event ${context.referenceType}`);
    }
  }

  /**
   * Chama now owes members their share of savings.
   * DR Member Savings   CR Payout Clearing
   */
  buildObligation(context) {
    return {
      transactionType: 'SAVINGS_SHAREOUT_OBLIGATION',
      description: context.description || 'Savings share-out obligation created',
      chama: context.chama || context.owner_id || context.ownerId || context.chamaId,
      member: context.member || context.memberId || context.created_by,
      amount: context.amount,
      currency: context.currency || 'KES',
      entries: [
        { accountCode: ACCOUNT_CODES.MEMBER_SAVINGS, entryType: ENTRY_TYPES.DEBIT, amount: context.amount },
        { accountCode: ACCOUNT_CODES.PAYOUT_CLEARING, entryType: ENTRY_TYPES.CREDIT, amount: context.amount },
      ],
    };
  }

  /**
   * Treasurer confirms a member's share was actually sent.
   * DR Payout Clearing   CR Cash/Bank/Mpesa
   */
  buildSettlement(context) {
    const assetAccount = this.resolveDisbursementAccount(
      context.disbursement_method || context.metadata?.disbursement_method
    );

    return {
      transactionType: 'SAVINGS_SHAREOUT_SETTLEMENT',
      description: context.description || 'Savings share-out settlement',
      chama: context.chama || context.owner_id || context.ownerId || context.chamaId,
      member: context.member || context.memberId || context.created_by,
      amount: context.amount,
      currency: context.currency || 'KES',
      entries: [
        { accountCode: ACCOUNT_CODES.PAYOUT_CLEARING, entryType: ENTRY_TYPES.DEBIT, amount: context.amount },
        { accountCode: assetAccount, entryType: ENTRY_TYPES.CREDIT, amount: context.amount },
      ],
    };
  }

  /**
   * Reverse an obligation that never got paid (item or whole batch cancelled).
   * DR Payout Clearing   CR Member Savings
   */
  buildCancellation(context) {
    return {
      transactionType: 'SAVINGS_SHAREOUT_CANCELLATION',
      description: context.description || 'Savings share-out cancelled',
      chama: context.chama || context.owner_id || context.ownerId || context.chamaId,
      member: context.member || context.memberId || context.created_by,
      amount: context.amount,
      currency: context.currency || 'KES',
      entries: [
        { accountCode: ACCOUNT_CODES.PAYOUT_CLEARING, entryType: ENTRY_TYPES.DEBIT, amount: context.amount },
        { accountCode: ACCOUNT_CODES.MEMBER_SAVINGS, entryType: ENTRY_TYPES.CREDIT, amount: context.amount },
      ],
    };
  }

  resolveDisbursementAccount(method) {
    const accounts = {
      cash: ACCOUNT_CODES.CASH,
      bank: ACCOUNT_CODES.BANK,
      mpesa: ACCOUNT_CODES.MPESA_CLEARING,
    };

    const account = accounts[method];

    if (!account) {
      throw new Error(`Unsupported savings shareout disbursement method ${method}`);
    }

    return account;
  }
}

export default new SavingsShareoutRule();