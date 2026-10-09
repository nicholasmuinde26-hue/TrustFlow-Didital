import mongoose from 'mongoose';

// One attempt to close a financial year. The per-account rows live in
// YearEndSnapshot; this header carries the sealed hash, the approval link and
// the audit-chain coordinates the hash was sealed under.
const yearEndCloseSchema = new mongoose.Schema(
  {
    chama_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Chama', required: true, index: true },
    year_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChamaFinancialYear', required: true, index: true },

    state: {
      type: String,
      enum: ['pending_approval', 'sealed', 'cancelled', 'rejected', 'stale'],
      default: 'pending_approval',
      index: true,
    },

    period_start: { type: Date, required: true },
    period_end: { type: Date, required: true },

    // Settlement overrides used for this run, so a later re-check recomputes
    // with the same rules ({ [account_code | account_id]: settlement }).
    settlement_overrides: { type: mongoose.Schema.Types.Mixed, default: {} },

    snapshot_hash: { type: String, required: true },
    row_count: { type: Number, required: true },
    // Totals as canonical money strings (see yearEnd.calc.js summarizeRows).
    summary: { type: mongoose.Schema.Types.Mixed, default: {} },
    drift_accounts: { type: Number, default: 0 },

    approval_request_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalRequest', default: null },

    started_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sealed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    sealed_at: { type: Date, default: null },

    // Where the hash was sealed in the chama's audit chain.
    audit_log_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AuditLog', default: null },
    audit_sequence: { type: Number, default: null },
    audit_hash: { type: String, default: null },

    end_reason: { type: String, default: '' },
  },
  { timestamps: true }
);

// At most one live (pending) close per year, enforced by the database.
yearEndCloseSchema.index(
  { year_id: 1 },
  { unique: true, partialFilterExpression: { state: 'pending_approval' }, name: 'one_pending_close_per_year' }
);
// At most one sealed close per year.
yearEndCloseSchema.index(
  { year_id: 1 },
  { unique: true, partialFilterExpression: { state: 'sealed' }, name: 'one_sealed_close_per_year' }
);

export default mongoose.models.YearEndClose || mongoose.model('YearEndClose', yearEndCloseSchema);
