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
      sparse: true,
      index: true,
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

    // Stores a SHA-256 HMAC of the OTP, never the code itself. Anyone
    // with read access to this collection - a backup, a log shipper, a
    // compromised read replica, a support tool - could previously read
    // live login codes straight out of the document and use them
    // before they expired.
    otpCodeHash: {
      type: String,
      select: false,
    },

    // Wrong guesses against the currently pending OTP. Reset whenever a
    // new code is issued; once it passes env.otpMaxAttempts the code is
    // burned and a fresh one has to be requested.
    otpAttempts: {
      type: Number,
      default: 0,
      select: false,
    },

    otpExpiresAt: {
      type: Date,
      select: false,
    },

    // Which channel the currently pending OTP was sent through
    // ('sms' | 'email' | 'whatsapp') - cleared once verified.
    otpChannel: {
      type: String,
      enum: ['sms', 'email', 'whatsapp'],
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
    // USSD PIN (SEPARATE FROM THE WEB/APP PASSWORD)
    // ========================================
    //
    // A short numeric PIN used only to authenticate *XXX# USSD sessions.
    // Kept distinct from `password` since a USSD PIN has different
    // strength/format constraints (4 digits) and a different lockout
    // policy. bcrypt-hashed, never returned to the client.
    // ========================================

    ussd_pin: {
      type: String,
      select: false,
    },

    ussd_pin_set_at: {
      type: Date,
      default: null,
    },

    ussd_failed_pin_attempts: {
      type: Number,
      default: 0,
      select: false,
    },

    ussd_pin_locked_until: {
      type: Date,
      default: null,
      select: false,
    },

    // Language for the USSD menus ('en' | 'sw'). Null = platform default
    // (USSD_DEFAULT_LANGUAGE, else English). Set from USSD menu 8.
    ussd_language: {
      type: String,
      enum: ['en', 'sw', null],
      default: null,
    },

    // Any access token issued before this moment is rejected. Set by
    // platform support's "force logout" so it takes effect immediately
    // instead of waiting for the short-lived access token to expire.
    tokensValidAfter: {
      type: Date,
      default: null,
    },

    // ========================================
    // ACCOUNT STATUS
    // ========================================

    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'unverified'],
      default: 'unverified',
    },

    // ========================================
    // SYSTEM ROLE (SUPER ADMIN / SUB ADMIN / USER)
    // ========================================

    systemRole: {
      type: String,
      enum: ['user', 'sub_admin', 'super_admin'],
      default: 'user',
      index: true,
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
    delete ret.otpCodeHash;
    delete ret.otpAttempts;
    delete ret.otpExpiresAt;
    delete ret.otpChannel;
    delete ret.ussd_pin;
    delete ret.ussd_failed_pin_attempts;
    delete ret.ussd_pin_locked_until;
    delete ret.refreshToken;
    delete ret.__v;

    return ret;
  },
});

// ========================================
// EXPORT MODEL
// ========================================

export default mongoose.models.User || mongoose.model('User', userSchema);