// ========================================
// PAYMENT UTILS
// ========================================
//
// Responsibilities:
//
// - Validate payment methods
// - Validate payment providers
// - Validate payment statuses
// - Normalize phone numbers
// - Generate internal payment references
// - Generate idempotency keys
// - Validate provider references
// - Normalize payment amounts
//
// IMPORTANT:
//
// This file contains reusable payment helpers.
//
// It does NOT:
// - update ContributionObligation
// - create FinancialTransaction
// - post accounting entries
// - call M-Pesa
//
// Accounting remains inside:
//
// contributionPayment.service.js
//
// ========================================

import crypto from 'crypto';

import mongoose from 'mongoose';

import AppError
  from '../../utils/AppError.js';

import {
  toDecimal,
  isMoneyPositive
} from '../../shared/decimal.js';


// ========================================
// PAYMENT METHODS
// ========================================
//
// A contribution can be paid using
// different methods.
//
// Each ContributionPayment stores its
// own payment_method.
//
// Example:
//
// Obligation A
//     │
//     ├── Payment 1 → mpesa
//     ├── Payment 2 → bank
//     ├── Payment 3 → card
//     └── Payment 4 → cash
//
// ========================================

export const PAYMENT_METHODS = [

  'cash',

  'bank',

  'mpesa',

  'mobile_money',

  'card',

  'transfer',

  'other'

];


// ========================================
// PAYMENT PROVIDERS
// ========================================
//
// Provider identifies the external system
// responsible for processing the payment.
//
// Examples:
//
// mpesa → safaricom
// card  → stripe
// card  → pesapal
//
// ========================================

export const PAYMENT_PROVIDERS = [

  'safaricom_mpesa',

  'pesapal',

  'stripe',

  'bank',

  'manual',

  'other'

];


// ========================================
// PAYMENT STATUSES
// ========================================

export const PAYMENT_STATUSES = [

  'pending',

  'processing',

  'completed',

  'failed',

  'reversed',

  'cancelled'

];


// ========================================
// VALIDATE PAYMENT METHOD
// ========================================

export const validatePaymentMethod = (
  payment_method
) => {

  if (
    !payment_method ||
    typeof payment_method !== 'string'
  ) {

    throw new AppError(
      'Payment method is required',
      400
    );

  }

  const normalizedMethod =
    payment_method
      .trim()
      .toLowerCase();

  if (
    !PAYMENT_METHODS.includes(
      normalizedMethod
    )
  ) {

    throw new AppError(
      `Invalid payment method. Supported methods: ${PAYMENT_METHODS.join(', ')}`,
      400
    );

  }

  return normalizedMethod;

};


// ========================================
// VALIDATE PAYMENT PROVIDER
// ========================================

export const validatePaymentProvider = (
  provider
) => {

  if (
    provider === null ||
    provider === undefined
  ) {

    return null;

  }

  if (
    typeof provider !== 'string'
  ) {

    throw new AppError(
      'Payment provider must be a string',
      400
    );

  }

  const normalizedProvider =
    provider
      .trim()
      .toLowerCase();

  if (
    !normalizedProvider
  ) {

    return null;

  }

  if (
    !PAYMENT_PROVIDERS.includes(
      normalizedProvider
    )
  ) {

    throw new AppError(
      `Invalid payment provider. Supported providers: ${PAYMENT_PROVIDERS.join(', ')}`,
      400
    );

  }

  return normalizedProvider;

};


// ========================================
// VALIDATE PAYMENT STATUS
// ========================================

export const validatePaymentStatus = (
  status
) => {

  if (
    !PAYMENT_STATUSES.includes(
      status
    )
  ) {

    throw new AppError(
      `Invalid payment status. Supported statuses: ${PAYMENT_STATUSES.join(', ')}`,
      400
    );

  }

  return status;

};


// ========================================
// VALIDATE PAYMENT METHOD / PROVIDER
// ========================================
//
// Ensures that the provider makes sense
// for the selected payment method.
//
// ========================================

export const validatePaymentMethodProvider = ({
  payment_method,
  provider
}) => {

  const method =
    validatePaymentMethod(
      payment_method
    );

  const normalizedProvider =
    validatePaymentProvider(
      provider
    );

  if (
    method === 'mpesa'
  ) {

    if (
      normalizedProvider &&
      normalizedProvider !==
      'safaricom_mpesa'
    ) {

      throw new AppError(
        'M-Pesa payments must use the Safaricom M-Pesa provider',
        400
      );

    }

    return {

      payment_method:
        method,

      provider:
        normalizedProvider ||
        'safaricom_mpesa'

    };

  }


  if (
    method === 'cash'
  ) {

    if (
      normalizedProvider &&
      normalizedProvider !==
      'manual'
    ) {

      throw new AppError(
        'Cash payments must use the manual provider',
        400
      );

    }

    return {

      payment_method:
        method,

      provider:
        normalizedProvider ||
        'manual'

    };

  }


  return {

    payment_method:
      method,

    provider:
      normalizedProvider

  };

};


// ========================================
// VALIDATE PAYMENT AMOUNT
// ========================================

export const validatePaymentAmount = (
  amount
) => {

  let paymentAmount;

  try {

    paymentAmount =
      toDecimal(
        amount
      );

  } catch {

    throw new AppError(
      'Invalid payment amount',
      400
    );

  }

  if (
    !isMoneyPositive(
      paymentAmount
    )
  ) {

    throw new AppError(
      'Payment amount must be greater than zero',
      400
    );

  }

  return paymentAmount;

};


// ========================================
// VALIDATE CURRENCY
// ========================================

export const validateCurrency = (
  currency
) => {

  if (
    !currency ||
    typeof currency !== 'string'
  ) {

    throw new AppError(
      'Payment currency is required',
      400
    );

  }

  const normalizedCurrency =
    currency
      .trim()
      .toUpperCase();

  if (
    normalizedCurrency.length !== 3
  ) {

    throw new AppError(
      'Currency must be a valid 3-letter currency code',
      400
    );

  }

  return normalizedCurrency;

};


// ========================================
// NORMALIZE PHONE NUMBER
// ========================================
//
// Supports common Kenyan formats:
//
// 0712345678
// 0112345678
// +254712345678
// 254712345678
//
// Returns:
//
// 254712345678
//
// This is the format expected by
// Safaricom Daraja.
//
// ========================================

export const normalizeKenyanPhoneNumber = (
  phone_number
) => {

  if (
    !phone_number ||
    typeof phone_number !== 'string'
  ) {

    throw new AppError(
      'A valid Kenyan phone number is required',
      400
    );

  }

  let phone =
    phone_number
      .trim()
      .replace(
        /[\s-]/g,
        ''
      );


  // +254712345678
  if (
    phone.startsWith(
      '+254'
    )
  ) {

    phone =
      phone.slice(1);

  }


  // 0712345678
  if (
    phone.startsWith(
      '0'
    )
  ) {

    phone =
      `254${phone.slice(1)}`;

  }


  // 254712345678
  if (
    !/^2547\d{8}$/.test(
      phone
    ) &&
    !/^2541\d{8}$/.test(
      phone
    )
  ) {

    throw new AppError(
      'Invalid Kenyan phone number. Expected format 0712345678 or 254712345678',
      400
    );

  }

  return phone;

};


// ========================================
// MASK PHONE NUMBER
// ========================================
//
// Used for logs and API responses.
//
// 254712345678
//
// becomes:
//
// 254*****5678
//
// ========================================

export const maskPhoneNumber = (
  phone_number
) => {

  if (
    !phone_number
  ) {

    return null;

  }

  const phone =
    String(
      phone_number
    );

  if (
    phone.length < 8
  ) {

    return '********';

  }

  return (

    phone.slice(
      0,
      3
    ) +

    '*****' +

    phone.slice(
      -4
    )

  );

};


// ========================================
// GENERATE INTERNAL PAYMENT REFERENCE
// ========================================
//
// This identifies a payment inside
// ChamaManager.
//
// Example:
//
// PAY-20260727-A8F3D91C
//
// ========================================

export const generatePaymentReference = () => {

  const datePart =
    new Date()
      .toISOString()
      .slice(
        0,
        10
      )
      .replace(
        /-/g,
        ''
      );

  const randomPart =
    crypto
      .randomBytes(
        4
      )
      .toString(
        'hex'
      )
      .toUpperCase();

  return (

    `PAY-${datePart}-${randomPart}`

  );

};


// ========================================
// GENERATE IDEMPOTENCY KEY
// ========================================
//
// Prevents duplicate payment initiation.
//
// Particularly important for:
//
// - M-Pesa STK Push
// - Card payments
// - Network retries
// - Frontend double clicks
//
// ========================================

export const generateIdempotencyKey = () => {

  return crypto
    .randomUUID();

};


// ========================================
// VALIDATE IDEMPOTENCY KEY
// ========================================

export const validateIdempotencyKey = (
  idempotency_key
) => {

  if (
    !idempotency_key ||
    typeof idempotency_key !== 'string'
  ) {

    throw new AppError(
      'Idempotency key is required',
      400
    );

  }

  const normalizedKey =
    idempotency_key
      .trim();

  if (
    !normalizedKey
  ) {

    throw new AppError(
      'Idempotency key cannot be empty',
      400
    );

  }

  if (
    normalizedKey.length > 150
  ) {

    throw new AppError(
      'Idempotency key cannot exceed 150 characters',
      400
    );

  }

  return normalizedKey;

};


// ========================================
// VALIDATE EXTERNAL REFERENCE
// ========================================
//
// Examples:
//
// M-Pesa:
// QWE123456
//
// Bank:
// BANK-TXN-12345
//
// Card:
// pi_123456789
//
// ========================================

export const validateExternalReference = (
  external_reference
) => {

  if (
    external_reference === null ||
    external_reference === undefined
  ) {

    return null;

  }

  if (
    typeof external_reference !== 'string'
  ) {

    throw new AppError(
      'External payment reference must be a string',
      400
    );

  }

  const normalizedReference =
    external_reference
      .trim();

  if (
    !normalizedReference
  ) {

    return null;

  }

  if (
    normalizedReference.length > 150
  ) {

    throw new AppError(
      'External payment reference cannot exceed 150 characters',
      400
    );

  }

  return normalizedReference;

};


// ========================================
// VALIDATE M-PESA ACCOUNT NUMBER
// ========================================
//
// For M-Pesa, this is usually the phone
// number used to receive the STK Push.
//
// ========================================

export const validateMpesaPhoneNumber = (
  phone_number
) => {

  return normalizeKenyanPhoneNumber(
    phone_number
  );

};


// ========================================
// VALIDATE OBJECT ID
// ========================================

export const validateObjectId = (
  value,
  fieldName
) => {

  if (
    !value ||
    !mongoose.Types.ObjectId.isValid(
      value
    )
  ) {

    throw new AppError(
      `Invalid ${fieldName}`,
      400
    );

  }

  return value;

};


// ========================================
// BUILD PAYMENT METADATA
// ========================================
//
// Stores provider-specific information
// without mixing it into accounting logic.
//
// Example:
//
// {
//   provider: 'safaricom_mpesa',
//   phone_number: '254*****5678',
//   checkout_request_id: 'ws_CO...'
// }
//
// IMPORTANT:
//
// Never store:
// - M-Pesa PIN
// - Card CVV
// - Card PIN
// - Sensitive authentication secrets
//
// ========================================

export const buildPaymentMetadata = ({
  payment_method,
  provider,
  phone_number = null,
  checkout_request_id = null,
  merchant_request_id = null
}) => {

  const metadata = {

    payment_method:
      payment_method || null,

    provider:
      provider || null

  };


  if (
    phone_number
  ) {

    metadata.phone_number =
      maskPhoneNumber(
        phone_number
      );

  }


  if (
    checkout_request_id
  ) {

    metadata.checkout_request_id =
      checkout_request_id;

  }


  if (
    merchant_request_id
  ) {

    metadata.merchant_request_id =
      merchant_request_id;

  }


  return metadata;

};