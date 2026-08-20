/**
 * ============================================================================
 * PAYMENT VALIDATORS
 * ============================================================================
 */

import crypto from "node:crypto"; // FIX: needed for auto-gen
import { PaymentValidationError } from "./payment.errors.js";
import { toDecimal, isMoneyPositive } from "../shared/decimal.js";
import { CURRENCY, PAYMENT_PROVIDER } from './payment.constants.js';

export function validateInitiatePayment(context) {
    if (!context) {
        throw new PaymentValidationError("Payment context is missing.");
    }

    console.log('[validateInitiatePayment] incoming keys:', Object.keys(context)); // DEBUG

    const rawAmount = context.payment?.amount?? context.amount;
    if (rawAmount === undefined || rawAmount === null) {
        throw new PaymentValidationError("Payment amount is required.");
    }

    const amount = toDecimal(rawAmount);
    if (!isMoneyPositive(amount)) {
        throw new PaymentValidationError("Payment amount must be greater than zero.");
    }

    const providerName = typeof context.provider === 'string'
      ? context.provider
        : context.provider?.name;

    if (!providerName) {
        throw new PaymentValidationError("Payment provider is required.");
    }

    const phone = context.participant?.phoneNumber || context.phoneNumber;
    if (providerName.toLowerCase() === PAYMENT_PROVIDER.MPESA &&!phone) {
        throw new PaymentValidationError("Phone number is required for M-Pesa payments.");
    }

    // FIX: Accept both camelCase and snake_case, then normalize + auto-generate
    const actorId = context.actorId || context.actor_id || context.created_by;
    let idempotencyKey = context.idempotencyKey || context.idempotency_key;
    if (!idempotencyKey) {
        idempotencyKey = crypto.randomUUID(); // auto-generate instead of throwing
        console.warn('[validateInitiatePayment] idempotencyKey missing, auto-generated:', idempotencyKey);
    }
    let displayReference = context.displayReference || context.display_reference;
    if (!displayReference) displayReference = `REF-${Date.now()}`;

    const participantType = context.participantType || context.participant_type || "ChamaMembership";
    const participantId = context.participantId || context.participant_id;
    const obligationId = context.obligationId || context.obligation_id;
    const planId = context.planId || context.plan_id;
    const chamaId = context.chamaId || context.chama_id;

    // Required fields for PaymentIntent schema
    if (!actorId) throw new PaymentValidationError("actorId is required.");
    if (!participantId) throw new PaymentValidationError("participantId is required.");
    if (!chamaId) throw new PaymentValidationError("chamaId is required.");

    // DO NOT MUTATE. Return new normalized context
    return {
      ...context,
        amount, // Decimal for DB
        amountNumber: Number(amount), // number for MpesaProvider
        currency: context.currency || CURRENCY.KES,
        provider: { name: providerName }, // keep as object for provider registry
        phoneNumber: phone,
        participantType,
        participantId,
        actorId,
        idempotencyKey,
        displayReference,
        reference: context.reference || `TXN-${Date.now()}`,
        obligationId,
        planId,
        chamaId,
        participant: {...(context.participant || {}), phoneNumber: phone }
    };
}

export const validateInitiateRequest = validateInitiatePayment;

export function validateCallback(callbackPayload) {
    if (!callbackPayload) {
        throw new PaymentValidationError("Callback payload is missing.");
    }
    if (!callbackPayload.provider) {
        throw new PaymentValidationError("Callback provider identifier is required.");
    }
    return true;
}

export function validateQuery(payload) {
    if (!payload) {
        throw new PaymentValidationError("Query payload is required.");
    }
    if (!payload.provider) {
        throw new PaymentValidationError("Query provider is required.");
    }
    return true;
}

export function validateCompletion(context) {
    if (!context) {
        throw new PaymentValidationError("Completion context is missing.");
    }
    if (!context.payment?.id &&!context.payment?._id) {
        throw new PaymentValidationError("Payment ID is required.");
    }
    return true;
}