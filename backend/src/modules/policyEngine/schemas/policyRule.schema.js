import mongoose from 'mongoose';
import { TRIGGER_MODES, CONDITION_TYPES, ACTION_TYPES } from '../constants/policyEngine.constants.js';

// ========================================
// SHARED SUB-SCHEMAS
// ========================================
//
// These are NOT standalone models. They're embedded sub-schemas meant to
// replace the ad-hoc trigger/eligibility fields inside ChamaLoanPolicy,
// SavingsSharePolicy, and MgrPolicy, e.g.:
//
//   import { triggerRuleSchema, conditionSchema } from
//     '../policyEngine/schemas/policyRule.schema.js';
//
//   const savingsSharePolicySchema = new mongoose.Schema({
//     ...
//     trigger_rule: { type: triggerRuleSchema, default: () => ({}) },
//     eligibility_conditions: { type: [conditionSchema], default: [] },
//     ...
//   });
//
// SavingsSharePolicy's existing trigger_rule shape (mode + schedule) is
// what this is modeled on, since it's already the most complete of the
// three today. Adopting it elsewhere is additive — old fields
// (recipients_rule.require_active_membership etc.) can stay as-is during
// a transition and be read as a fallback if eligibility_conditions is
// empty, so nothing breaks existing chamas mid-migration.
//
// ========================================

const scheduleSchema = new mongoose.Schema(
  {
    frequency: { type: String, enum: ['yearly', 'quarterly', 'monthly', 'weekly', 'daily', 'custom'], default: 'monthly' },
    run_month: { type: Number, min: 1, max: 12, default: null },
    run_day: { type: Number, min: 1, max: 31, default: null },
    run_every_days: { type: Number, min: 1, default: null },
    next_run_at: { type: Date, default: null },
  },
  { _id: false }
);

export const triggerRuleSchema = new mongoose.Schema(
  {
    mode: { type: String, enum: TRIGGER_MODES, default: 'manual', required: true },
    schedule: { type: scheduleSchema, default: () => ({}) },
    // Only used when mode is 'event' or 'both'. Must match a key in
    // notification.constants.js#DOMAIN_EVENTS, e.g. 'LOAN_SUBMITTED'.
    event_name: { type: String, default: null },
  },
  { _id: false }
);

export const conditionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: Object.values(CONDITION_TYPES), required: true },
    // Free-form params for the condition (e.g. { months: 3 } for
    // MIN_TENURE_MONTHS, { score: 60 } for TRUST_SCORE_MIN). Kept as
    // Mixed rather than one field per possible param, since each
    // condition type has a different shape.
    params: { type: mongoose.Schema.Types.Mixed, default: {} },
    // If true, failing this condition blocks the action outright. If
    // false, failing it only downgrades the action (e.g. still allowed,
    // but routed to REQUIRE_APPROVAL instead of AUTO_APPROVE). This is
    // what lets a single trust-score condition mean "block" in a strict
    // chama and "add a review step" in a lenient one, from the same
    // engine.
    blocking: { type: Boolean, default: true },
  },
  { _id: false }
);

export const actionSpecSchema = new mongoose.Schema(
  {
    on_pass: {
      type: { type: String, enum: Object.values(ACTION_TYPES), default: 'REQUIRE_APPROVAL' },
      params: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    on_fail: {
      type: { type: String, enum: Object.values(ACTION_TYPES), default: 'REQUIRE_APPROVAL' },
      params: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
  },
  { _id: false }
);