import mongoose from 'mongoose';


// ========================================
// CHAMA SCHEMA
// ========================================

const chamaSchema = new mongoose.Schema(
  {

    // ========================================
    // CHAMA NAME
    // ========================================

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100
    },


    // ========================================
    // MONTHLY SAVINGS
    // ========================================

    monthly_savings: {
      type: Number,
      required: true,
      min: 1
    },


    // ========================================
    // CHAMA CREATOR
    // ========================================
    //
    // This identifies the User who originally
    // created the Chama.
    //
    // It does NOT determine the current role.
    //
    // The creator's role is stored in:
    //
    // ChamaMembership.role
    //
    // ========================================

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },


    // ========================================
    // CHAMA STATUS
    // ========================================

    status: {
      type: String,
      enum: [
        'active',
        'inactive',
        'closed'
      ],
      default: 'active'
    }

  },
  {
    timestamps: true
  }
);


// ========================================
// EXPORT MODEL
// ========================================

export default mongoose.model(
  'Chama',
  chamaSchema
);