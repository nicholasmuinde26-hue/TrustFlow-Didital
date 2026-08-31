import mongoose from 'mongoose';

// ========================================
// CHAMA LOAN
// ========================================
//
// One document per loan application/loan.
// Follows the lifecycle:
//
//   draft -> submitted -> eligibility_failed
//                       -> pending_approval -> rejected
//                                            -> approved -> disbursement_pending
//                                                         -> active -> partially_repaid
//                                                                    -> overdue -> defaulted -> recovered
//                                                                    -> closed
//
// See modules/loans/loan.constants.js for the canonical status list.
//
// ========================================

const guarantorSchema = new mongoose.Schema(
  {
    membership_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChamaMembership', required: true },
    guaranteed_amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
    requested_at: { type: Date, default: Date.now },
    responded_at: { type: Date, default: null },
    // Filled in only if this guarantor's savings were actually drawn down
    // during a recovery event (spec section 18).
    recovered_amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const approvalSchema = new mongoose.Schema(
  {
    membership_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChamaMembership', required: true },
    role: { type: String, required: true },
    decision: { type: String, enum: ['approved', 'rejected'], required: true },
    comment: { type: String, default: null },
    decided_at: { type: Date, default: Date.now },
    ip_address: { type: String, default: null },
  },
  { _id: false }
);

const scheduleItemSchema = new mongoose.Schema(
  {
    installment_number: { type: Number, required: true },
    due_date: { type: Date, required: true },
    principal_due: { type: Number, required: true, default: 0 },
    interest_due: { type: Number, required: true, default: 0 },
    total_due: { type: Number, required: true, default: 0 },
    principal_paid: { type: Number, default: 0 },
    interest_paid: { type: Number, default: 0 },
    penalty_accrued: { type: Number, default: 0 },
    penalty_paid: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'partial', 'paid', 'overdue'], default: 'pending' },
    paid_at: { type: Date, default: null },
  },
  { _id: false }
);

const eligibilitySchema = new mongoose.Schema(
  {
    eligible: { type: Boolean, default: null },
    reason: { type: String, default: null },
    savings_balance: { type: Number, default: null },
    loan_limit: { type: Number, default: null },
    existing_outstanding: { type: Number, default: null },
    membership_months: { type: Number, default: null },
    checked_at: { type: Date, default: null },
  },
  { _id: false }
);

const riskSchema = new mongoose.Schema(
  {
    score: { type: Number, default: null },
    level: { type: String, enum: ['low', 'medium', 'high', null], default: null },
    positive_factors: { type: [String], default: [] },
    risk_factors: { type: [String], default: [] },
    assessed_at: { type: Date, default: null },
  },
  { _id: false }
);

const disbursementSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ['pending', 'processing', 'successful', 'failed', 'reversed', null], default: null },
    provider: { type: String, default: null }, // 'mpesa' | 'bank' | 'cash'
    provider_reference: { type: String, default: null }, // M-Pesa conversation ID
    originator_conversation_id: { type: String, default: null },
    disbursed_at: { type: Date, default: null },
    failure_reason: { type: String, default: null },
  },
  { _id: false }
);

const balancesSchema = new mongoose.Schema(
  {
    principal_outstanding: { type: Number, default: 0 },
    interest_outstanding: { type: Number, default: 0 },
    penalty_outstanding: { type: Number, default: 0 },
  },
  { _id: false }
);

const defaultInfoSchema = new mongoose.Schema(
  {
    is_default: { type: Boolean, default: false },
    defaulted_at: { type: Date, default: null },
    days_late: { type: Number, default: 0 },
    recovery_status: { type: String, enum: ['none', 'notice_sent', 'in_recovery', 'recovered', null], default: 'none' },
    recovery_notice_sent_at: { type: Date, default: null },
  },
  { _id: false }
);

const closureSchema = new mongoose.Schema(
  {
    closed_at: { type: Date, default: null },
    closed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    final_payment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanPayment', default: null },
    total_principal_paid: { type: Number, default: 0 },
    total_interest_paid: { type: Number, default: 0 },
    total_penalties_paid: { type: Number, default: 0 },
  },
  { _id: false }
);

const chamaLoanSchema = new mongoose.Schema(
  {
    chama_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Chama', required: true, index: true },
    membership_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChamaMembership', required: true, index: true },

    reference: { type: String, unique: true, sparse: true, index: true },

    loan_type: { type: String, enum: ['standard', 'emergency', 'topup', 'group'], default: 'standard' },
    // For top-ups: the original loan this one extends (spec section 23.2).
    parent_loan_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChamaLoan', default: null },

    amount: { type: Number, required: true, min: 1 },
    purpose: { type: String, required: true },
    repayment_period_months: { type: Number, required: true, min: 1 },
    repayment_frequency: { type: String, enum: ['weekly', 'monthly'], default: 'monthly' },

    disbursement_method: { type: String, enum: ['mpesa', 'bank', 'cash'], default: 'mpesa' },
    phone_number: { type: String, default: null },
    disbursement_account: { type: String, default: null },

    interest_rate_percent: { type: Number, default: 0 },
    interest_type: { type: String, enum: ['flat', 'reducing_balance'], default: 'flat' },
    interest_amount: { type: Number, default: 0 },
    total_payable: { type: Number, default: 0 },

    status: {
      type: String,
      enum: [
        'draft', 'submitted', 'eligibility_failed', 'blocked_conflict', 'pending_approval', 'rejected',
        'approved', 'disbursement_pending', 'disbursed', 'active', 'partially_repaid',
        'overdue', 'defaulted', 'recovered', 'closed', 'cancelled',
      ],
      default: 'draft',
      index: true,
    },

    eligibility: { type: eligibilitySchema, default: () => ({}) },
    guarantors: { type: [guarantorSchema], default: [] },

    required_approval_roles: { type: [String], default: [] },
    approvals: { type: [approvalSchema], default: [] },
    rejected_at: { type: Date, default: null },
    rejection_reason: { type: String, default: null },
    approved_at: { type: Date, default: null },

    // Conflict-of-interest routing (spec: "the applicant can never approve
    // or disburse their own loan"). When the applicant holds one of the
    // required approval roles, that seat is recused and replaced with a
    // quorum of independent officials instead. See Loanconflict.service.js.
    conflict_of_interest: { type: Boolean, default: false },
    recused_roles: { type: [String], default: [] },
    recusal_quorum_required: { type: Number, default: 0, min: 0 },
    governance_block_reason: { type: String, default: null },

    disbursement: { type: disbursementSchema, default: () => ({}) },

    repayment_schedule: { type: [scheduleItemSchema], default: [] },
    balances: { type: balancesSchema, default: () => ({}) },

    risk: { type: riskSchema, default: () => ({}) },
    default_info: { type: defaultInfoSchema, default: () => ({}) },
    closure: { type: closureSchema, default: () => ({}) },

    // Group loans (spec section 23.3): members jointly responsible.
    group_members: [
      {
        membership_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChamaMembership' },
        allocation: { type: Number, default: 0 },
      },
    ],
    collateral_notes: { type: String, default: null },

    submitted_at: { type: Date, default: null },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Tracks an in-flight M-Pesa STK repayment until Safaricom's callback
    // confirms or fails it (spec section 14, Option A).
    pending_repayment: {
      checkout_request_id: { type: String, default: null, index: true },
      merchant_request_id: { type: String, default: null },
      amount: { type: Number, default: null },
      phone_number: { type: String, default: null },
      initiated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      initiated_at: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

chamaLoanSchema.index({ chama_id: 1, status: 1 });
chamaLoanSchema.index({ chama_id: 1, membership_id: 1 });
chamaLoanSchema.index({ 'guarantors.membership_id': 1 });

export default mongoose.models.ChamaLoan || mongoose.model('ChamaLoan', chamaLoanSchema);