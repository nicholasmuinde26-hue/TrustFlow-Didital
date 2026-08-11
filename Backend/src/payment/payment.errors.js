export class PaymentError extends Error {
  constructor(message, code = 'PAYMENT_ERROR') {
    super(message);
    this.name = 'PaymentError';
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class DuplicatePaymentError extends PaymentError {
  constructor(message = 'Duplicate payment detected') {
    super(message, 'DUPLICATE_PAYMENT');
    this.name = 'DuplicatePaymentError';
  }
}

export class PaymentNotFoundError extends PaymentError {
  constructor(message = 'Payment not found') {
    super(message, 'PAYMENT_NOT_FOUND');
    this.name = 'PaymentNotFoundError';
  }
}

export class PaymentAlreadyCompletedError extends PaymentError {
  constructor(message = 'Payment already completed') {
    super(message, 'PAYMENT_ALREADY_COMPLETED');
    this.name = 'PaymentAlreadyCompletedError';
  }
}

export class PaymentValidationError extends PaymentError { // <- ADD THIS
  constructor(message = 'Payment validation failed', details = null) {
    super(message, 'PAYMENT_VALIDATION_ERROR');
    this.name = 'PaymentValidationError';
    this.details = details;
  }
}

export class ProviderError extends PaymentError {
  constructor(message = 'Provider error', provider = null) {
    super(message, 'PROVIDER_ERROR');
    this.name = 'ProviderError';
    this.provider = provider;
  }
}