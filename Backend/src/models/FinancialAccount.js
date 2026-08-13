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
      enum: ['Chama', 'ContributionGroup'],
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
    }
  },
  { timestamps: true }
);

// ========================================
// INDEXES
// ========================================
financialAccountSchema.index({ owner_type: 1, owner_id: 1, account_code: 1 }, { unique: true, sparse: true, name: 'unique_account_code_per_owner' });
financialAccountSchema.index({ owner_type: 1, owner_id: 1, name: 1 }, { unique: true, name: 'unique_account_name_per_owner' });
financialAccountSchema.index({ owner_type: 1, owner_id: 1, system_key: 1 }, { unique: true, sparse: true, name: 'unique_system_key_per_owner' });
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
    { owner_type, owner_id, name: 'Payout Clearing', account_code: 'PAYOUT_CLEARING', system_key: 'payout_clearing', account_type: 'liability', normal_balance: 'credit', account_category: 'clearing', is_system_account: true, description: 'Pending member payouts', created_by }
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
      ret.current_balance = ret.current_balance.toString();
    }
    return ret;
  }
});

// ========================================
// EXPORT MODEL
// ========================================
export default mongoose.model("FinancialAccount", financialAccountSchema);