import mongoose from "mongoose";
const { Schema } = mongoose;

// Force clear model cache for ESM hot reload on Windows
if (mongoose.models.FinancialAccount) {
  delete mongoose.models.FinancialAccount;
}

// ========================================
// FINANCIAL ACCOUNT SCHEMA
// ========================================
const financialAccountSchema = new Schema(
  {
    owner_type: {
      type: String,
      enum: ['Chama', 'ContributionGroup', 'Business'],
      required: true,
      index: true
    },
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100
    },
    system_key: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 50,
      default: null
    },
    account_code: {
      type: String,
      trim: true,
      maxlength: 20,
      default: null
    },
    account_type: {
      type: String,
      enum: ['asset', 'liability', 'equity', 'income', 'expense'],
      required: true,
      index: true
    },
    normal_balance: {
      type: String,
      enum: ['debit', 'credit'],
      required: true
    },
    account_category: {
      type: String,
      enum: ['cash', 'bank', 'mpesa', 'mobile_money', 'receivable', 'payable', 'contribution', 'loan', 'payout', 'welfare', 'savings', 'income', 'expense', 'equity', 'clearing', 'other'],
      default: 'other',
      required: true
    },
    currency: {
      type: String,
      default: 'KES',
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
      required: true
    },
    current_balance: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0
    },

    // ========================================
    // RESERVED BALANCE ("held" funds)
    // ========================================
    //
    // current_balance is the ledger-true balance. reserved_balance is money
    // within that balance that has been committed to an APPROVED but not
    // yet SETTLED obligation (e.g. an approved member withdrawal, an
    // approved payout, a pending expense) — see financeAccount.service.js
    // reserveFunds()/releaseFunds(). It never goes negative and never
    // exceeds current_balance in correct usage.
    //
    // available_balance (current_balance - reserved_balance) is what a
    // treasurer may safely commit to a NEW obligation. Without this split,
    // the same cash can be promised to two different payouts/withdrawals
    // at once and only be discovered missing when the second one settles.
    //
    reserved_balance: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'closed'],
      default: 'active',
      required: true,
      index: true
    },
    is_system_account: {
      type: Boolean,
      default: false
    },
    // Which pool of money the account belongs to. 'business' = money earned by
    // chama-owned businesses and properties (see
    // modules/finance/accounting/businessFunds.constants.js). It is kept out
    // of the pooled chama balance, member savings and member contributions,
    // and has its own income statement and balance sheet. Accounts created
    // before this field existed have no value; they are treated as 'chama'
    // unless their code marks them as business accounts (isBusinessFundAccount).
    fund_scope: {
      type: String,
      enum: ['chama', 'business'],
      default: 'chama',
      index: true
    },
    // Sub-ledger link. A per-contribution account points at the system
    // account it rolls up under (MEMBER_CONTRIBUTIONS). Postings go to the
    // child OR the parent, never both, so flat reports don't double count.
    parent_account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FinancialAccount',
      default: null,
      index: true
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    closed_at: {
      type: Date,
      default: null
    },

    // ========================================
    // CASH-IN-HAND DEPOSIT CLOCK
    // ========================================
    // Only meaningful for the CASH system account (account_code: 'CASH').
    // Chama policy: physical cash a treasurer records must not sit
    // un-banked for more than a fixed window (default 48h, see
    // cashDeposit.service.js) - it must be deposited into the BANK
    // account. This block tracks that clock at the account level:
    //   - held_since is set the moment the CASH balance first moves
    //     above zero (i.e. cash starts accumulating) and is left
    //     untouched by later cash receipts, so it always reflects the
    //     OLDEST un-banked cash, not the most recent.
    //   - held_since (and the rest of this block) is cleared the moment
    //     the CASH balance returns to zero or below - fully deposited.
    //   - due_at / is_overdue / reminders are maintained by
    //     financeAccountService + the cashDepositEnforcement job.
    cash_deposit_tracking: {
      held_since: { type: Date, default: null },
      due_at: { type: Date, default: null },
      is_overdue: { type: Boolean, default: false },
      overdue_since: { type: Date, default: null },
      last_reminder_sent_at: { type: Date, default: null },
      reminder_count: { type: Number, default: 0 },
      last_broadcast_sent_at: { type: Date, default: null },
      inflow_locked: { type: Boolean, default: false }
    }
  },
  { timestamps: true }
);

// ========================================
// INDEXES
// ========================================
// account_code and system_key both default to null. A *sparse* unique index still
// indexes an explicit null, so the second account without a code / system key
// for the same owner threw E11000 (e.g. the first POS sale of a chama-owned
// business creating its income account). A partial index only covers real
// string values, so unnamed accounts never collide with each other.
const UNIQUE_WHEN_SET = [
  { name: 'unique_account_code_per_owner', field: 'account_code' },
  { name: 'unique_system_key_per_owner', field: 'system_key' },
].map(({ name, field }) => ({
  name,
  field,
  key: { owner_type: 1, owner_id: 1, [field]: 1 },
  options: { unique: true, partialFilterExpression: { [field]: { $type: 'string' } }, name },
}));

for (const { key, options } of UNIQUE_WHEN_SET) financialAccountSchema.index(key, options);
financialAccountSchema.index({ owner_type: 1, owner_id: 1, name: 1 }, { unique: true, name: 'unique_account_name_per_owner' });

financialAccountSchema.index({ owner_type: 1, owner_id: 1, status: 1 });
financialAccountSchema.index({ owner_type: 1, owner_id: 1, account_type: 1 });
financialAccountSchema.index({ owner_type: 1, owner_id: 1, is_system_account: 1 });

// ========================================
// VALIDATION - NO NEXT PARAM TO AVOID "next is not a function"
// ========================================
financialAccountSchema.pre('validate', function () {
  const debitNormalTypes = ['asset', 'expense'];
  const creditNormalTypes = ['liability', 'equity', 'income'];

  if (debitNormalTypes.includes(this.account_type) && this.normal_balance!== 'debit') {
    throw new Error(`Account type "${this.account_type}" must have a debit normal balance`);
  }
  if (creditNormalTypes.includes(this.account_type) && this.normal_balance!== 'credit') {
    throw new Error(`Account type "${this.account_type}" must have a credit normal balance`);
  }
  if (!this.is_system_account && this.system_key) {
    throw new Error('Only system accounts can have a system_key');
  }
  if (this.status === 'closed' &&!this.closed_at) {
    this.closed_at = new Date();
  }
  if (this.status!== 'closed') {
    this.closed_at = null;
  }
});

// ========================================
// STATIC HELPERS - MUST BE AFTER SCHEMA
// ========================================
financialAccountSchema.statics.bootstrapSystemAccounts = async function({ owner_type, owner_id, created_by = null }) {
  const accounts = [
    { owner_type, owner_id, name: 'Cash', account_code: 'CASH', system_key: 'cash', account_type: 'asset', normal_balance: 'debit', account_category: 'cash', is_system_account: true, description: 'Physical cash holdings', created_by },
    { owner_type, owner_id, name: 'Bank', account_code: 'BANK', system_key: 'bank', account_type: 'asset', normal_balance: 'debit', account_category: 'bank', is_system_account: true, description: 'Bank account', created_by },
    { owner_type, owner_id, name: 'M-Pesa Clearing', account_code: 'MPESA_CLEARING', system_key: 'mpesa', account_type: 'asset', normal_balance: 'debit', account_category: 'mpesa', is_system_account: true, description: 'M-Pesa wallet clearing account', created_by },
    { owner_type, owner_id, name: 'Member Contributions', account_code: 'MEMBER_CONTRIBUTIONS', system_key: 'member_contributions', account_type: 'equity', normal_balance: 'credit', account_category: 'contribution', is_system_account: true, description: 'Member savings and contributions', created_by },
    { owner_type, owner_id, name: 'Member Savings', account_code: 'MEMBER_SAVINGS', system_key: 'member_savings', account_type: 'equity', normal_balance: 'credit', account_category: 'savings', is_system_account: true, description: 'Member savings wallet', created_by }, // <-- ADDED
    { owner_type, owner_id, name: 'Payout Clearing', account_code: 'PAYOUT_CLEARING', system_key: 'payout_clearing', account_type: 'liability', normal_balance: 'credit', account_category: 'clearing', is_system_account: true, description: 'Pending member payouts', created_by },
    { owner_type, owner_id, name: 'Withdrawal Clearing', account_code: 'WITHDRAWAL_CLEARING', system_key: 'withdrawal_clearing', account_type: 'liability', normal_balance: 'credit', account_category: 'clearing', is_system_account: true, description: 'Approved member withdrawals awaiting disbursement', created_by }
  ];

  const results = [];
  for (const acc of accounts) {
    const existing = await this.findOne({ owner_type, owner_id, account_code: acc.account_code });
    if (!existing) {
      results.push(await this.create(acc));
    } else {
      results.push(existing);
    }
  }
  return results;
};

// ========================================
// JSON TRANSFORM
// ========================================
financialAccountSchema.set('toJSON', {
  transform: (_doc, ret) => {
    if (ret.current_balance!== undefined && ret.current_balance!== null) {
      const currentStr = ret.current_balance.toString();
      const reservedStr = (ret.reserved_balance!== undefined && ret.reserved_balance!== null)
        ? ret.reserved_balance.toString()
        : '0';
      ret.current_balance = currentStr;
      ret.reserved_balance = reservedStr;
      // Convenience field for the frontend — what's actually free to commit
      // to a new obligation right now. Computed here rather than stored.
      ret.available_balance = (Number(currentStr) - Number(reservedStr)).toFixed(2);
    }
    return ret;
  }
});

// ========================================
// EXPORT MODEL
// ========================================
const FinancialAccount = mongoose.model("FinancialAccount", financialAccountSchema);

// Databases created before the fix still hold the old sparse indexes under the
// same names, which Mongoose cannot replace on its own (index options
// conflict). Swap them for the partial versions once at startup. Idempotent:
// does nothing when the indexes are already correct.
async function healNullableUniqueIndexes() {
  try {
    const existing = await FinancialAccount.collection.indexes().catch(() => []);
    for (const { name, key, options } of UNIQUE_WHEN_SET) {
      const found = existing.find((index) => index.name === name);
      if (found && !found.partialFilterExpression) {
        await FinancialAccount.collection.dropIndex(name);
        console.info(`[FinancialAccount] Replaced legacy index ${name} with a partial index`);
      }
      if (!found || !found.partialFilterExpression) {
        await FinancialAccount.collection.createIndex(key, options);
      }
    }
  } catch (error) {
    console.warn("[FinancialAccount] Could not repair account indexes:", error.message);
  }
}
healNullableUniqueIndexes();

export default FinancialAccount;