import mongoose from "mongoose";
const { Schema } = mongoose;

/**
 * ============================================================================
 * CHAMA BANK ACCOUNT
 * ============================================================================
 *
 * Real-world bank account details a chama deposits its cash into. This is
 * metadata (bank name, account number, branch, etc) - the actual money and
 * running balance still live on the single system 'BANK' FinancialAccount
 * (see FinancialAccount.bootstrapSystemAccounts). Every deposit slip
 * recorded against one of these accounts references it via
 * financial_account_id so the ledger always resolves back to a specific,
 * real bank account even though there's one GL balance behind it.
 * ============================================================================
 */

const chamaBankAccountSchema = new Schema(
  {
    owner_type: {
      type: String,
      enum: ["Chama", "ContributionGroup"],
      required: true,
      index: true
    },
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    // The system BANK FinancialAccount this bank account posts against.
    financial_account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinancialAccount",
      default: null
    },
    bank_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    account_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    account_number: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40
    },
    branch: {
      type: String,
      trim: true,
      maxlength: 120,
      default: ""
    },
    swift_code: {
      type: String,
      trim: true,
      maxlength: 20,
      default: ""
    },
    paybill_or_till: {
      type: String,
      trim: true,
      maxlength: 20,
      default: ""
    },
    currency: {
      type: String,
      default: "KES",
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3
    },
    is_primary: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ""
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    deactivated_at: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

chamaBankAccountSchema.index(
  { owner_type: 1, owner_id: 1, bank_name: 1, account_number: 1 },
  { unique: true, name: "unique_bank_account_per_owner" }
);
chamaBankAccountSchema.index({ owner_type: 1, owner_id: 1, status: 1 });

// Only one primary bank account per owner - the deposit endpoint defaults
// to this one when the caller doesn't specify a bankAccountId.
chamaBankAccountSchema.pre("save", async function () {
  if (this.is_primary && this.isModified("is_primary")) {
    await this.constructor.updateMany(
      { owner_type: this.owner_type, owner_id: this.owner_id, _id: { $ne: this._id } },
      { $set: { is_primary: false } }
    );
  }
  if (this.status === "inactive" && !this.deactivated_at) {
    this.deactivated_at = new Date();
  }
  if (this.status === "active") {
    this.deactivated_at = null;
  }
});

// Masked account number for anywhere this gets surfaced without full detail.
chamaBankAccountSchema.methods.maskedAccountNumber = function () {
  const raw = this.account_number || "";
  if (raw.length <= 4) return raw;
  return `${"*".repeat(Math.max(raw.length - 4, 0))}${raw.slice(-4)}`;
};

// Mongoose instance methods aren't included when a document is serialized
// via res.json() - only schema fields are. Every API response (list,
// create, update) needs masked_account_number available as a plain field
// so the frontend never has to (and never accidentally does) render the
// full account number, so compute it here at serialization time.
chamaBankAccountSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.masked_account_number = doc.maskedAccountNumber();
    return ret;
  }
});

export default mongoose.model("ChamaBankAccount", chamaBankAccountSchema);
