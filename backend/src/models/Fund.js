import mongoose from 'mongoose';
import { FUND_KINDS, FUND_SETTLEMENTS } from '../constants/fund.constants.js';

// ========================================
// FUND
// ========================================
//
// The long-lived pot of money behind one or more contribution plans.
//
//   ContributionPlan  = a way of feeding money in (levy, harambee, campaign)
//   Fund              = where that money lives, and how the year ends for it
//   FinancialAccount  = the ledger account that holds the balance
//
// A Fund owns no money itself: the balance is its ledger account's balance.
// Plans point at a fund with ContributionPlan.fund_id (nullable: plans that post
// to the shared MEMBER_CONTRIBUTIONS / MEMBER_SAVINGS accounts, and merry-go-
// round plans, have no fund).
//
// `settlement` is the year-end default for the fund's ledger account
// (see yearEnd.constants.js SETTLEMENTS). It is applied when a close starts and
// stored on that close run, so editing a fund later never changes a close that
// is already pending approval.

const fundSchema = new mongoose.Schema(
  {
    owner_type: { type: String, enum: ['Chama', 'ContributionGroup'], required: true },
    owner_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    kind: { type: String, enum: FUND_KINDS, default: 'general', required: true },
    settlement: { type: String, enum: FUND_SETTLEMENTS, default: 'retained', required: true },
    ledger_account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FinancialAccount',
      required: true,
    },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

fundSchema.index({ owner_type: 1, owner_id: 1, name: 1 }, { unique: true, name: 'unique_fund_name_per_owner' });
// One ledger account backs at most one fund. Several PLANS may share a fund;
// two FUNDS sharing an account would double count on the year-end snapshot.
fundSchema.index({ ledger_account_id: 1 }, { unique: true, name: 'unique_fund_per_ledger_account' });

export default mongoose.models.Fund || mongoose.model('Fund', fundSchema);
