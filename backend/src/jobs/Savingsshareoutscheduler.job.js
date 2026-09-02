/**
 * ============================================================================
 * SAVINGS SHAREOUT SCHEDULER JOB
 * ============================================================================
 * Runs on an interval. Any active SavingsSharePolicy with trigger_rule.mode
 * of 'scheduled' or 'both' whose schedule is due gets an automatic
 * SavingsShareout batch created (built and left as 'pending_approval' —
 * this job never auto-approves or auto-disburses; an officer still signs
 * off per the policy's approval_rule).
 *
 * 'manual'-only policies are never touched here — those only ever get a
 * share-out via an explicit POST /savings-shareouts call.
 * ============================================================================
 */

import SavingsSharePolicy from '../models/SavingsSharePolicy.js';
import { createShareout } from '../modules/savingsShareout/savingsShareout.service.js';

const SWEEP_INTERVAL_MS = Number(process.env.SAVINGS_SHAREOUT_SCHEDULER_INTERVAL_MS) || 6 * 60 * 60 * 1000; // every 6h

let sweepInProgress = false;

// ============================================================
// COMPUTE NEXT RUN DATE
// ============================================================

const computeNextRunAt = (schedule, from = new Date()) => {
  const next = new Date(from);

  switch (schedule.frequency) {
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      next.setDate(Math.min(schedule.run_day || 1, 28));
      return next;

    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      next.setDate(Math.min(schedule.run_day || 1, 28));
      return next;

    case 'custom':
      next.setDate(next.getDate() + (schedule.run_every_days || 30));
      return next;

    case 'yearly':
    default:
      next.setFullYear(next.getFullYear() + 1);
      next.setMonth((schedule.run_month || 12) - 1);
      next.setDate(Math.min(schedule.run_day || 31, 28));
      return next;
  }
};

const dueDateFor = (schedule) => {
  if (schedule.next_run_at) return new Date(schedule.next_run_at);

  // First-ever run for this policy — anchor to this year/period's date.
  const now = new Date();
  const anchor = new Date(now);

  if (schedule.frequency === 'yearly') {
    anchor.setMonth((schedule.run_month || 12) - 1);
    anchor.setDate(Math.min(schedule.run_day || 31, 28));
  } else if (schedule.frequency === 'monthly' || schedule.frequency === 'quarterly') {
    anchor.setDate(Math.min(schedule.run_day || 1, 28));
  }

  return anchor;
};

export const sweepDueSavingsSharePolicies = async () => {
  if (sweepInProgress) return [];
  sweepInProgress = true;

  const created = [];

  try {
    const policies = await SavingsSharePolicy.find({
      status: 'active',
      'trigger_rule.mode': { $in: ['scheduled', 'both'] },
    });

    const now = new Date();

    for (const policy of policies) {
      const schedule = policy.trigger_rule?.schedule || {};
      const dueAt = dueDateFor(schedule);

      if (dueAt > now) continue;

      try {
        const shareout = await createShareout({
          chamaId: policy.chama_id,
          policyId: policy._id,
          created_by: policy.created_by,
          triggerType: 'scheduled',
          periodLabel: `Scheduled share-out ${now.toDateString()}`,
          asOfDate: now,
        });

        created.push(shareout);
      } catch (error) {
        // A single policy with no eligible balances shouldn't stop the
        // rest of the sweep from running.
        console.error(`[savings-shareout] Scheduled run failed for policy ${policy._id}:`, error.message);
      }

      policy.trigger_rule.schedule.next_run_at = computeNextRunAt(schedule, dueAt);
      await policy.save();
    }
  } catch (error) {
    console.error('[savings-shareout] Scheduler sweep failed:', error.message);
  } finally {
    sweepInProgress = false;
  }

  return created;
};

export const startSavingsShareoutSchedulerJob = () => {
  console.log(`[savings-shareout] Scheduler job started (every ${SWEEP_INTERVAL_MS / 1000 / 60}m)`);
  const timer = setInterval(sweepDueSavingsSharePolicies, SWEEP_INTERVAL_MS);
  timer.unref?.();
  return timer;
};