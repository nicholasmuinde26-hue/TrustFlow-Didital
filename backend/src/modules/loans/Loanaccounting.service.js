import crypto from 'node:crypto';
import mongoose from 'mongoose';
import FinancialAccount from '../../models/FinancialAccount.js';
import FinancialTransaction from '../../models/FinancialTransaction.js';
import Journal from '../../models/Journal.js';
import LedgerEntry from '../../models/LedgerEntry.js';
import financeAccountService from '../finance/financeAccount.service.js';

// ========================================
// CHART OF ACCOUNTS USED BY THE LOAN ENGINE
// ========================================

const LOAN_ACCOUNTS = {
  MPESA_CLEARING: { code: 'MPESA_CLEARING', name: 'M-Pesa Clearing', account_type: 'asset', normal_balance: 'debit', account_category: 'clearing' },
  LOAN_RECEIVABLE: { code: 'LOAN_RECEIVABLE', name: 'Loans Receivable', account_type: 'asset', normal_balance: 'debit', account_category: 'loan' },
  INTEREST_INCOME: { code: 'INTEREST_INCOME', name: 'Loan Interest Income', account_type: 'income', normal_balance: 'credit', account_category: 'income' },
  PENALTY_INCOME: { code: 'PENALTY_INCOME', name: 'Loan Penalty Income', account_type: 'income', normal_balance: 'credit', account_category: 'income' },
  MEMBER_SAVINGS: { code: 'MEMBER_SAVINGS', name: 'Member Savings', account_type: 'liability', normal_balance: 'credit', account_category: 'savings' },
};

async function getOrCreateAccount(code, chamaId) {
  const spec = LOAN_ACCOUNTS[code];
  if (!spec) throw new Error(`Unknown loan account code '${code}'`);

  let account = await FinancialAccount.findOne({ owner_type: 'Chama', owner_id: chamaId, account_code: spec.code });
  if (account) return account;

  try {
    account = await FinancialAccount.create({
      owner_type: 'Chama',
      owner_id: chamaId,
      name: spec.name,
      account_code: spec.code,
      account_type: spec.account_type,
      normal_balance: spec.normal_balance,
      account_category: spec.account_category,
      current_balance: 0,
      status: 'active',
    });
  } catch (error) {
    // Concurrent creation lost the race — read the account another
    // request just created instead of failing the whole operation.
    if (error?.code === 11000) {
      account = await FinancialAccount.findOne({ owner_type: 'Chama', owner_id: chamaId, account_code: spec.code });
    } else {
      throw error;
    }
  }
  return account;
}

const entryType = (account, direction) => {
  // direction: 'increase' | 'decrease' relative to the account's own balance
  const isDebitNormal = account.normal_balance === 'debit';
  if (direction === 'increase') return isDebitNormal ? 'debit' : 'credit';
  return isDebitNormal ? 'credit' : 'debit';
};

async function postJournal({ chamaId, memberId, transactionType, amount, description, legs, sourceType, sourceId, userId, session = null, externalReference = null }) {
  const reference = `LNJ-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  const transaction = await FinancialTransaction.create(
    [{
      owner_type: 'Chama',
      owner_id: chamaId,
      transaction_type: transactionType,
      amount,
      currency: 'KES',
      source_type: sourceType,
      source_id: sourceId,
      external_reference: externalReference,
      reference,
      status: 'posted',
      description,
      created_by: userId,
      posted_by: userId,
      posted_at: new Date(),
    }],
    { session }
  ).then((docs) => docs[0]);

  const totalDebit = legs.filter((l) => l.entry_type === 'debit').reduce((s, l) => s + l.amount, 0);
  const totalCredit = legs.filter((l) => l.entry_type === 'credit').reduce((s, l) => s + l.amount, 0);

  const journal = await Journal.create(
    [{
      journalNumber: `JR-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      transaction: transaction._id,
      chama: chamaId,
      member: memberId || undefined,
      transactionType,
      amount,
      currency: 'KES',
      narration: description,
      status: 'POSTED',
      totalDebit,
      totalCredit,
      provider: 'loan_engine',
    }],
    { session }
  ).then((docs) => docs[0]);

  const entries = await LedgerEntry.insertMany(
    legs.map((leg) => ({
      transaction_id: transaction._id,
      owner_type: 'Chama',
      owner_id: chamaId,
      account_id: leg.account._id,
      entry_type: leg.entry_type,
      amount: leg.amount,
      currency: 'KES',
      description: leg.description || description,
      status: 'posted',
      posted_at: new Date(),
      posted_by: userId,
    })),
    { session }
  );

  await financeAccountService.applyEntries(entries, session);

  return { transaction, journal, entries };
}

/**
 * Loan disbursement:
 *   Debit  Loans Receivable   (asset up — member owes the Chama)
 *   Credit M-Pesa Clearing    (asset down — cash left the Chama)
 */
export async function postDisbursement({ chama, loan, userId, session = null }) {
  const loanReceivable = await getOrCreateAccount('LOAN_RECEIVABLE', chama._id);
  const cash = await getOrCreateAccount('MPESA_CLEARING', chama._id);

  return postJournal({
    chamaId: chama._id,
    transactionType: 'loan_disbursement',
    amount: loan.amount,
    description: `Loan disbursement — ${loan.reference}`,
    sourceType: 'ChamaLoan',
    sourceId: loan._id,
    userId,
    session,
    legs: [
      { account: loanReceivable, entry_type: entryType(loanReceivable, 'increase'), amount: loan.amount, description: 'Loan issued' },
      { account: cash, entry_type: entryType(cash, 'decrease'), amount: loan.amount, description: 'Funds disbursed' },
    ],
  });
}

/**
 * Loan repayment (single combined journal per payment, split across the
 * penalty / interest / principal legs the waterfall allocated):
 *   Debit  M-Pesa Clearing / Cash   (asset up — cash received)
 *   Credit Loans Receivable          (principal portion)
 *   Credit Loan Interest Income      (interest portion)
 *   Credit Loan Penalty Income       (penalty portion)
 */
export async function postRepayment({ chama, loan, payment, userId, session = null }) {
  const cash = await getOrCreateAccount('MPESA_CLEARING', chama._id);
  const loanReceivable = await getOrCreateAccount('LOAN_RECEIVABLE', chama._id);
  const interestIncome = await getOrCreateAccount('INTEREST_INCOME', chama._id);
  const penaltyIncome = await getOrCreateAccount('PENALTY_INCOME', chama._id);

  const legs = [{ account: cash, entry_type: entryType(cash, 'increase'), amount: payment.amount, description: 'Loan repayment received' }];

  if (payment.allocation.principal > 0) {
    legs.push({ account: loanReceivable, entry_type: entryType(loanReceivable, 'decrease'), amount: payment.allocation.principal, description: 'Principal repaid' });
  }
  if (payment.allocation.interest > 0) {
    legs.push({ account: interestIncome, entry_type: entryType(interestIncome, 'increase'), amount: payment.allocation.interest, description: 'Interest income' });
  }
  if (payment.allocation.penalty > 0) {
    legs.push({ account: penaltyIncome, entry_type: entryType(penaltyIncome, 'increase'), amount: payment.allocation.penalty, description: 'Penalty income' });
  }

  return postJournal({
    chamaId: chama._id,
    memberId: undefined,
    transactionType: 'loan_repayment',
    amount: payment.amount,
    description: `Loan repayment — ${loan.reference}`,
    sourceType: 'LoanPayment',
    sourceId: payment._id,
    userId,
    session,
    externalReference: payment.external_reference,
    legs,
  });
}

/**
 * Guarantor recovery: the guarantor's own savings are used to cover a
 * defaulted balance.
 *   Debit  Member Savings (the guarantor's liability balance is drawn down)
 *   Credit Loans Receivable (the borrower's outstanding loan shrinks)
 */
export async function postGuarantorRecovery({ chama, loan, amount, userId, session = null }) {
  const savings = await getOrCreateAccount('MEMBER_SAVINGS', chama._id);
  const loanReceivable = await getOrCreateAccount('LOAN_RECEIVABLE', chama._id);

  return postJournal({
    chamaId: chama._id,
    transactionType: 'loan_repayment',
    amount,
    description: `Guarantor recovery — ${loan.reference}`,
    sourceType: 'ChamaLoan',
    sourceId: loan._id,
    userId,
    session,
    legs: [
      { account: savings, entry_type: entryType(savings, 'decrease'), amount, description: 'Guarantor savings drawn down' },
      { account: loanReceivable, entry_type: entryType(loanReceivable, 'decrease'), amount, description: 'Loan balance reduced by recovery' },
    ],
  });
}

export default { postDisbursement, postRepayment, postGuarantorRecovery };