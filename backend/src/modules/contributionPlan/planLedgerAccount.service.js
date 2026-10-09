import FinancialAccount from '../../models/FinancialAccount.js';
import ContributionPlan from '../../models/ContributionPlan.js';
import { ownsLedgerAccount } from '../../constants/contributionBehavior.constants.js';

/**
 * ============================================================================
 * PER-PLAN LEDGER ACCOUNTS
 * ============================================================================
 *
 * Each contribution gets its own account, created as a CHILD of
 * MEMBER_CONTRIBUTIONS when the plan is activated. "Hisa", "Mchango wa
 * Mazishi" and "Ada ya Mwaka" then appear as separate lines on the trial
 * balance and balance sheet.
 *
 * ROUTING RULE
 * ------------
 * A plan with `ledger_account_id` posts (payments in, payouts out) to that
 * account. A plan without one posts to the shared MEMBER_CONTRIBUTIONS
 * account exactly as it always did. The account is assigned once, at
 * activation, and never later - so a plan that started on the shared account
 * is never split across two accounts mid-life, and no history is rewritten.
 *
 * Postings go to the child OR the parent, never both, so reports that sum
 * every account stay correct.
 *
 * Switch off with PLAN_LEDGER_ACCOUNTS=false. Plans that already have an
 * account keep using it.
 *
 * NOT YET COVERED: savings-behaviour plans. Their money-out path (withdrawals,
 * share-outs, the fund reservation in Withdrawal.service) debits
 * MEMBER_SAVINGS by code, so a child of MEMBER_SAVINGS would collect deposits
 * that withdrawals never draw down. They stay on MEMBER_SAVINGS until that
 * path is plan-aware. Set PLAN_LEDGER_SAVINGS=true only after that work.
 *
 * Accounts are created OUTSIDE any surrounding transaction on purpose: a
 * duplicate-key race inside a transaction would abort the whole payment. An
 * empty leftover account is harmless and gets reused.
 * ============================================================================
 */

export const planLedgersEnabled = () => !['false', '0', 'off'].includes(String(process.env.PLAN_LEDGER_ACCOUNTS || '').toLowerCase());
const savingsChildrenEnabled = () => String(process.env.PLAN_LEDGER_SAVINGS || '').toLowerCase() === 'true';

export const planAccountCode = (plan) => `CP-${String(plan._id).slice(-12).toUpperCase()}`;

const parentCodeFor = (plan) => (plan.behavior === 'savings' ? 'MEMBER_SAVINGS' : 'MEMBER_CONTRIBUTIONS');

const accountName = (plan, suffix = '') => `Contributions - ${plan.name}${suffix}`.slice(0, 100);

const findParent = async (plan) => {
  const filter = { owner_type: plan.owner_type, owner_id: plan.owner_id, account_code: parentCodeFor(plan) };
  let parent = await FinancialAccount.findOne(filter);
  // Chamas get their system accounts on demand.
  if (!parent) {
    await FinancialAccount.bootstrapSystemAccounts({ owner_type: plan.owner_type, owner_id: plan.owner_id, created_by: plan.created_by || null });
    parent = await FinancialAccount.findOne(filter);
  }
  return parent;
};

/**
 * Create (or find) the plan's child account and record it on the plan.
 * Returns null when the plan should stay on the shared account. Safe to call
 * repeatedly.
 */
export const ensurePlanLedgerAccount = async (plan, { force = false, actorUserId = null } = {}) => {
  if (!plan || !ownsLedgerAccount(plan)) return null;
  // Chama plans only: contribution-group funds pay out against the shared account.
  if (plan.owner_type !== 'Chama') return null;
  if (!force && !planLedgersEnabled()) return null;
  if (plan.behavior === 'savings' && !savingsChildrenEnabled()) return null;

  if (plan.ledger_account_id) {
    const existing = await FinancialAccount.findById(plan.ledger_account_id);
    if (existing) return existing;
  }

  const parent = await findParent(plan);
  if (!parent) return null;

  const filter = { owner_type: plan.owner_type, owner_id: plan.owner_id, account_code: planAccountCode(plan) };
  let account = await FinancialAccount.findOne(filter);

  if (!account) {
    const doc = {
      ...filter,
      name: accountName(plan),
      account_type: parent.account_type,
      normal_balance: parent.normal_balance,
      account_category: parent.account_category,
      parent_account_id: parent._id,
      currency: plan.currency || parent.currency || 'KES',
      // Not a system account: system accounts may not be closed or renamed,
      // and the model only allows a system_key on those.
      is_system_account: false,
      description: `Money collected under the "${plan.name}" contribution`,
      created_by: actorUserId || plan.created_by || null,
    };
    try {
      account = await FinancialAccount.create(doc);
    } catch (err) {
      if (err?.code !== 11000) throw err;
      // Either another request just made it, or the NAME is taken by another account.
      account = await FinancialAccount.findOne(filter);
      if (!account) account = await FinancialAccount.create({ ...doc, name: accountName(plan, ` (${doc.account_code})`) });
    }
  }

  // Only ever set once; a plan's account never changes after that.
  await ContributionPlan.updateOne({ _id: plan._id, ledger_account_id: null }, { $set: { ledger_account_id: account._id } });
  plan.ledger_account_id = plan.ledger_account_id || account._id;
  return account;
};

/**
 * The account a posting for this plan should use, or null for "use the
 * shared default". Read-only - it never creates an account. A closed account
 * is treated as absent so postings fall back rather than fail.
 */
export const resolvePlanLedgerAccount = async (planId) => {
  if (!planId) return null;
  const plan = await ContributionPlan.findById(planId).select('ledger_account_id').lean();
  if (!plan?.ledger_account_id) return null;
  const account = await FinancialAccount.findById(plan.ledger_account_id).select('_id status').lean();
  if (!account || account.status === 'closed') return null;
  return account;
};

/** Keep the account's display name in step when a plan is renamed. Best effort. */
export const syncPlanLedgerAccountName = async (plan) => {
  if (!plan?.ledger_account_id) return;
  try {
    await FinancialAccount.updateOne({ _id: plan.ledger_account_id }, { $set: { name: accountName(plan) } });
  } catch (err) {
    console.warn('[planLedger] rename skipped:', err.message);
  }
};
