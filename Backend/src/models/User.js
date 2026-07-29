import mongoose from 'mongoose';


// ========================================
// USER SCHEMA
// ========================================
//
// User represents the global account.
//
// Chama-specific information belongs to:
//
// ChamaMembership
//
// Therefore:
//
// User
//  ├── name
//  ├── phone
//  ├── password
//  └── status
//
// ChamaMembership
//  ├── user_id
//  ├── chama_id
//  ├── role
//  ├── status
//  └── payout_position
//
// ========================================

const userSchema = new mongoose.Schema(
  {

    // ========================================
    // USER NAME
    // ========================================

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100
    },


    // ========================================
    // PHONE NUMBER
    // ========================================

    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },


    // ========================================
    // PASSWORD
    // ========================================

    password: {
      type: String,
      required: true,
      select: false
    },


    // ========================================
    // ACCOUNT STATUS
    // ========================================
    //
    // This is the status of the global User
    // account.
    //
    // It is different from:
    //
    // ChamaMembership.status
    //
    // ========================================

    status: {
      type: String,
      enum: [
        'active',
        'inactive',
        'suspended'
      ],
      default: 'active'
    }

  },
  {
    timestamps: true
  }
);


// ========================================
// REMOVE PASSWORD FROM JSON RESPONSES
// ========================================

userSchema.set(
  'toJSON',
  {
    transform: (doc, ret) => {

      delete ret.password;

      delete ret.__v;

      return ret;

    }
  }
);


// ========================================
// EXPORT MODEL
// ========================================

export default mongoose.model(
  'User',
  userSchema
);