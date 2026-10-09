import mongoose from 'mongoose';

// ========================================
// CHAMA FINANCIAL YEAR
// ========================================
//
// Kenyan chamas do not all run January-December. Some run on the
// calendar year, some on the government year (July-June), some start
// their year at the AGM month. The chairperson/treasurer sets the
// year here and every contribution calendar (leadership grid, member
// dashboard) is drawn inside it.
//
// Rules enforced by the service, not the schema:
//   - at most ONE 'active' year per chama
//   - years for one chama never overlap
//
// status:
//   upcoming - starts in the future
//   active   - the year the chama is currently operating in
//   closed   - finished (or closed early by leadership)
//
// ========================================

const chamaFinancialYearSchema = new mongoose.Schema(
  {
    chama_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chama',
      required: true,
      index: true
    },

    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60
    },

    start_date: { type: Date, required: true },

    // Inclusive last day of the year (stored as end-of-day).
    end_date: { type: Date, required: true },

    status: {
      type: String,
      enum: ['upcoming', 'active', 'closed'],
      default: 'active',
      index: true
    },

    notes: { type: String, trim: true, maxlength: 300, default: '' },

    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    closed_at: { type: Date, default: null },
    closed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Year-end close lifecycle (see modules/yearEnd). Kept apart from `status`
    // so a year stays 'active' while it is 'closing'. Documents created before
    // this field existed have none; yearEnd treats missing as open/closed by status.
    close_state: { type: String, enum: ['open', 'closing', 'closed'], default: 'open' },
    current_close_id: { type: mongoose.Schema.Types.ObjectId, ref: 'YearEndClose', default: null },
    sealed_hash: { type: String, default: null }
  },
  { timestamps: true }
);

chamaFinancialYearSchema.pre('validate', function () {
  if (this.start_date && this.end_date && this.end_date <= this.start_date) {
    throw new Error('Financial year end date must be after its start date');
  }
});

chamaFinancialYearSchema.index({ chama_id: 1, start_date: 1 });

// One active year per chama, enforced by the database as well as the
// service so two concurrent requests cannot both create one.
chamaFinancialYearSchema.index(
  { chama_id: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
    name: 'one_active_financial_year_per_chama'
  }
);

export default mongoose.model('ChamaFinancialYear', chamaFinancialYearSchema);