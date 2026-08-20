import mongoose from 'mongoose';

// ========================================
// LOAN PAYMENT
// ========================================
//
// Every repayment received creates ONE immutable
// LoanPayment record showing exactly how the
// amount was allocated across penalty, interest,
// and principal.
//
// This is the audit trail behind the loan's
// `balances` and `repayment_schedule` fields.
//
// ========================================

const loanPaymentSchema = new mongoose.Schema(
  {
    chama_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Chama', required: true, index: true },
    loan_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChamaLoan', required: true, index: true },
    membership_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChamaMembership', required: true },

    amount: { type: Number, required: true, min: 0.01 },

    allocation: {
      penalty: { type: Number, default: 0 },
      interest: { type: Number, default: 0 },
      principal: { type: Number, default: 0 },
    },

    source: {
      type: String,
      enum: ['mpesa', 'contribution_deduction', 'manual', 'guarantor_recovery'],
      required: true,
    },

    reference: { type: String, unique: true, sparse: true, index: true },
    external_reference: { type: String, default: null }, // M-Pesa receipt, etc.

    financial_transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: 'FinancialTransaction', default: null },

    recorded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    paid_at: { type: Date, default: Date.now },

    // Snapshot of the loan's outstanding balance immediately after this
    // payment was applied — useful for statements without re-deriving history.
    balance_after: {
      principal_outstanding: { type: Number, default: 0 },
      interest_outstanding: { type: Number, default: 0 },
      penalty_outstanding: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

loanPaymentSchema.index({ loan_id: 1, createdAt: -1 });

export default mongoose.models.LoanPayment || mongoose.model('LoanPayment', loanPaymentSchema);