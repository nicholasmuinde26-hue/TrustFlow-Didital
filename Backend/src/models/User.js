import mongoose from 'mongoose';

// ========================================
// USER SCHEMA
// ========================================
//
// User represents the global account.
//
// Chama-specific information belongs to:
// ChamaMembership
//
// User
//  ├── name
//  ├── phone
//  ├── email (optional)
//  ├── id_number (optional)
//  ├── avatar_url (optional, base64 data URI)
//  ├── password (optional for OTP-first auth)
//  ├── status ('active' | 'inactive' | 'suspended' | 'unverified')
//  ├── isPhoneVerified
//  ├── otpCode & otpExpiresAt
//  └── refreshToken
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
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    // ========================================
    // PHONE NUMBER
    // ========================================

    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    // ========================================
    // EMAIL (OPTIONAL)
    // ========================================

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },

    // ========================================
    // NATIONAL ID NUMBER (OPTIONAL)
    // ========================================
    //
    // Basic profile-level ID number. This is
    // distinct from ChamaMemberKyc.id_number,
    // which is chama-scoped and tied to a
    // verified selfie + ID document during the
    // formal KYC review flow.
    //
    // ========================================

    id_number: {
      type: String,
      trim: true,
      default: null,
    },

    // ========================================
    // AVATAR / PROFILE PHOTO (OPTIONAL)
    // ========================================
    //
    // Stored as a base64 data URI
    // (data:image/png;base64,...).
    //
    // NOTE: This project has no configured
    // object storage (S3/Cloudinary/etc), so
    // photos are stored inline for now. Swap
    // this out for a real upload + hosted URL
    // if avatars need to scale beyond a small
    // number of members per Chama.
    //
    // ========================================

    avatar_url: {
      type: String,
      default: null,
    },

    // ========================================
    // PASSWORD (OPTIONAL FOR SMS OTP AUTH)
    // ========================================

    password: {
      type: String,
      required: false,
      select: false,
    },

    // ========================================
    // PHONE VERIFICATION STATUS
    // ========================================

    isPhoneVerified: {
      type: Boolean,
      default: false,
    },

    // ========================================
    // OTP AUTHENTICATION FIELDS
    // ========================================

    otpCode: {
      type: String,
      select: false,
    },

    otpExpiresAt: {
      type: Date,
      select: false,
    },

    // ========================================
    // REFRESH TOKEN (FOR 7-DAY ROTATION & REVOCATION)
    // ========================================

    refreshToken: {
      type: String,
      select: false,
    },

    // ========================================
    // ACCOUNT STATUS
    // ========================================

    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'unverified'],
      default: 'unverified',
    },
  },
  {
    timestamps: true,
  }
);

// ========================================
// REMOVE SENSITIVE FIELDS FROM JSON RESPONSES
// ========================================

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.otpCode;
    delete ret.otpExpiresAt;
    delete ret.refreshToken;
    delete ret.__v;

    return ret;
  },
});

// ========================================
// EXPORT MODEL
// ========================================

export default mongoose.models.User || mongoose.model('User', userSchema);