import mongoose from 'mongoose';
import ChamaFinancialYear from '../../models/Chamafinancialyear.js';
import YearEndClose from '../../models/YearEndClose.js';
import YearEndSnapshot from '../../models/YearEndSnapshot.js';
import ApprovalRequest from '../../models/ApprovalRequest.js';
import AuditLog from '../../models/AuditLog.js';
import AppError from '../../utils/AppError.js';
import approvalService from '../approval/approval.service.js';
import { createAuditLog } from '../../services/audit.service.js';
import { AUDIT_ACTIONS } from '../../constants/audit.constants.js';
import {
  CLOSE_STATES, CLOSE_TRANSITIONS, RUN_STATES,
  APPROVAL_RESOURCE_TYPE, AUDIT_RESOURCE_TYPE,
} from './yearEnd.constants.js';
import { fromScaled, findUndistributed } from './yearEnd.calc.js';
import {
  computeSnapshot, persistSnapshot, verifyStoredSnapshot, countPendingTransactions,
} from './yearEnd.snapshot.service.js';
import { seedOpeningBalances, findNextYear } from './yearEnd.opening.service.js';
import { settlementOverridesWithFunds } from '../finance/fund.service.js';

// Fixed on purpose: the person starting a close must not be able to lower the
// bar for approving it. The initiator cannot approve their own close.
const REQUIRED_APPROVALS = 2;
const ELIGIBLE_ROLES = ['chairperson', 'secretary', 'treasurer'];

// Years created before close_state existed hydrate with the schema default
// ('open'), including years already closed - so `status` wins.
export const effectiveState = (year) =>
  year.status === 'closed' ? CLOSE_STATES.CLOSED : (year.close_state || CLOSE_STATES.OPEN);

const assertTransition = (from, to) => {
  if (!CLOSE_TRANSITIONS[from]?.includes(to)) {
    throw new AppError(`A financial year cannot move from "${from}" to "${to}".`, 409);
  }
};

const loadYear = async (chamaId, yearId) => {
  const year = await ChamaFinancialYear.findOne({ _id: yearId, chama_id: chamaId });
  if (!year) throw new AppError('Financial year not found.', 404);
  return year;
};

// Atomic state change. The filter carries the expected current state, so two
// concurrent callers cannot both win the same transition.
const transitionYear = async ({ chamaId, yearId, from, to, set = {} }) => {
  assertTransition(from, to);
  const stateFilter = from === CLOSE_STATES.OPEN
    ? { close_state: { $nin: [CLOSE_STATES.CLOSING, CLOSE_STATES.CLOSED] } }
    : { close_state: from };
  const updated = await ChamaFinancialYear.findOneAndUpdate(
    { _id: yearId, chama_id: chamaId, status: { $ne: 'closed' }, ...stateFilter },
    { $set: { close_state: to, ...set } },
    { returnDocument: 'after' }
  );
  if (!updated) {
    throw new AppError('The financial year changed state while this request was running. Reload and try again.', 409);
  }
  return updated;
};

const money = (n) => mongoose.Types.Decimal128.fromString(n);

// ---------------------------------------------------------------------------
// open -> closing
// ---------------------------------------------------------------------------
export const beginClose = async ({
  chamaId, yearId, userId, membershipId, settlementOverrides = {}, note = '',
}) => {
  const year = await loadYear(chamaId, yearId);
  const state = effectiveState(year);

  if (state === CLOSE_STATES.CLOSED) throw new AppError('This financial year is already closed.', 409);
  if (state === CLOSE_STATES.CLOSING) {
    throw new AppError('A year-end close is already in progress for this financial year.', 409);
  }
  if (year.status !== 'active') {
    throw new AppError('Only the active financial year can be closed.', 409);
  }
  if (!membershipId) throw new AppError('A chama membership is required to start a year-end close.', 403);

  const pending = await countPendingTransactions(chamaId, year);
  if (pending > 0) {
    throw new AppError(
      `${pending} transaction(s) in this year are still pending. Post or cancel them before closing the year.`,
      409
    );
  }

  // Claim the year first so a second request fails fast instead of racing us.
  const claimed = await transitionYear({
    chamaId, yearId, from: CLOSE_STATES.OPEN, to: CLOSE_STATES.CLOSING,
  });

  let run = null;
  let approval = null;
  try {
    // Lazily seed this year's openings from the previous sealed close, if any.
    await seedOpeningBalances({ chamaId, targetYear: claimed });

    // Fund settlements are the defaults; anything passed explicitly wins. The merged
    // result is what gets stored on the run below, so the approval-time re-check
    // recomputes with exactly these overrides even if a fund is edited meanwhile.
    const effectiveOverrides = await settlementOverridesWithFunds(chamaId, settlementOverrides);
    const snapshot = await computeSnapshot({ chamaId, year: claimed, overrides: effectiveOverrides });

    const stuck = findUndistributed(snapshot.rows);
    if (stuck.length) {
      const list = stuck.map((r) => `${r.account_code || r.name} (${fromScaled(r.closing)})`).join(', ');
      throw new AppError(
        `These accounts are marked "distributed" but still hold a balance: ${list}. Pay the money out, or change their settlement.`,
        409
      );
    }

    run = await YearEndClose.create({
      chama_id: chamaId,
      year_id: claimed._id,
      period_start: claimed.start_date,
      period_end: claimed.end_date,
      settlement_overrides: effectiveOverrides,
      snapshot_hash: snapshot.hash,
      row_count: snapshot.rows.length,
      summary: snapshot.summary,
      drift_accounts: snapshot.driftAccounts,
      started_by: userId,
      state: RUN_STATES.PENDING_APPROVAL,
    });
    await persistSnapshot({ closeId: run._id, chamaId, yearId: claimed._id, rows: snapshot.rows });

    approval = await approvalService.createRequest({
      chamaId,
      resourceType: APPROVAL_RESOURCE_TYPE,
      resourceId: run._id,
      action: 'CLOSE_YEAR',
      title: `Close financial year ${claimed.label}`,
      description:
        `Year-end close of ${claimed.label}. Carries forward ${snapshot.summary.carry_forward}; ` +
        `net result ${snapshot.summary.net_result}. Snapshot ${snapshot.hash.slice(0, 12)}…` +
        (snapshot.driftAccounts ? ` ${snapshot.driftAccounts} account(s) show balance drift.` : '') +
        (note ? ` Note: ${note}` : ''),
      amount: money(snapshot.summary.carry_forward),
      initiatedByMembershipId: membershipId,
      requiredApprovals: REQUIRED_APPROVALS,
      eligibleRoles: ELIGIBLE_ROLES,
      allowInitiatorApproval: false,
      metadata: { close_id: String(run._id), year_id: String(claimed._id), snapshot_hash: snapshot.hash },
    });

    run.approval_request_id = approval._id;
    await run.save();
    await ChamaFinancialYear.updateOne({ _id: claimed._id }, { $set: { current_close_id: run._id } });

    await createAuditLog({
      actorUserId: userId,
      scopeType: 'CHAMA',
      chamaId,
      action: AUDIT_ACTIONS.YEAR_END_CLOSE_STARTED,
      resourceType: AUDIT_RESOURCE_TYPE,
      resourceId: run._id,
      after: { year_id: String(claimed._id), snapshot_hash: snapshot.hash, row_count: snapshot.rows.length },
      metadata: { approval_request_id: String(approval._id), drift_accounts: snapshot.driftAccounts },
    });

    return { year: await ChamaFinancialYear.findById(claimed._id), close: run, approval, summary: snapshot.summary };
  } catch (error) {
    // Undo everything this attempt created so the year is usable again.
    if (approval) { try { await approvalService.cancelRequest(approval._id, membershipId, 'Year-end close failed to start'); } catch { /* best effort */ } }
    if (run) {
      await YearEndSnapshot.deleteMany({ close_id: run._id });
      await YearEndClose.deleteOne({ _id: run._id });
    }
    await ChamaFinancialYear.updateOne(
      { _id: yearId, close_state: CLOSE_STATES.CLOSING },
      { $set: { close_state: CLOSE_STATES.OPEN, current_close_id: null } }
    );
    throw error;
  }
};

// closing -> open, used by cancel, rejection and staleness.
const abortClose = async ({ year, run, runState, reason }) => {
  await YearEndClose.updateOne(
    { _id: run._id, state: RUN_STATES.PENDING_APPROVAL },
    { $set: { state: runState, end_reason: reason } }
  );
  await transitionYear({
    chamaId: year.chama_id, yearId: year._id, from: CLOSE_STATES.CLOSING, to: CLOSE_STATES.OPEN,
    set: { current_close_id: null },
  });
};

const loadClosingRun = async (year) => {
  if (!year.current_close_id) throw new AppError('No year-end close is in progress for this financial year.', 409);
  const run = await YearEndClose.findById(year.current_close_id);
  if (!run) throw new AppError('The year-end close record is missing.', 500);
  return run;
};

// ---------------------------------------------------------------------------
// closing -> open (leadership cancels)
// ---------------------------------------------------------------------------
export const cancelClose = async ({ chamaId, yearId, userId, membershipId, reason = '' }) => {
  const year = await loadYear(chamaId, yearId);
  if (effectiveState(year) !== CLOSE_STATES.CLOSING) {
    throw new AppError('This financial year is not being closed.', 409);
  }
  const run = await loadClosingRun(year);
  if (run.approval_request_id) {
    try { await approvalService.cancelRequest(run.approval_request_id, membershipId, reason || 'Year-end close cancelled'); }
    catch { /* already resolved - nothing to cancel */ }
  }
  await abortClose({ year, run, runState: RUN_STATES.CANCELLED, reason: reason || 'Cancelled by leadership' });
  await createAuditLog({
    actorUserId: userId, scopeType: 'CHAMA', chamaId,
    action: AUDIT_ACTIONS.YEAR_END_CLOSE_CANCELLED,
    resourceType: AUDIT_RESOURCE_TYPE, resourceId: run._id,
    after: { snapshot_hash: run.snapshot_hash }, metadata: { reason },
  });
  return ChamaFinancialYear.findById(yearId);
};

// ---------------------------------------------------------------------------
// closing -> closed (requires the approval to be approved)
// Every step below is idempotent, so a crash part-way is fixed by calling
// finalize again.
// ---------------------------------------------------------------------------
export const finalizeClose = async ({ chamaId, yearId, userId }) => {
  let year = await loadYear(chamaId, yearId);
  if (effectiveState(year) === CLOSE_STATES.CLOSED) return { year, alreadyClosed: true };
  if (effectiveState(year) !== CLOSE_STATES.CLOSING) {
    throw new AppError('Start a year-end close before finalizing it.', 409);
  }
  const run = await loadClosingRun(year);

  if (run.state === RUN_STATES.PENDING_APPROVAL) {
    const approval = await ApprovalRequest.findById(run.approval_request_id);
    if (!approval) throw new AppError('The approval request for this close is missing.', 500);
    if (['rejected', 'cancelled'].includes(approval.status)) {
      await abortClose({ year, run, runState: RUN_STATES.REJECTED, reason: `Approval ${approval.status}` });
      throw new AppError(`The year-end close was ${approval.status}. The financial year is open again.`, 409);
    }
    if (approval.status !== 'approved') {
      throw new AppError('The year-end close is still waiting for approval.', 409);
    }

    // 1. The stored snapshot must still hash to what the approvers saw.
    const stored = await verifyStoredSnapshot({ close: run, year });
    if (!stored.ok) {
      throw new AppError('Snapshot integrity check failed: stored rows do not match the approved hash. Nothing was sealed.', 409);
    }

    // 2. The ledger must still say the same thing. If money moved after the
    //    snapshot, the approval covered a different picture - void it.
    const pending = await countPendingTransactions(chamaId, year);
    const fresh = await computeSnapshot({ chamaId, year, overrides: run.settlement_overrides || {} });
    if (fresh.hash !== run.snapshot_hash || pending > 0) {
      await abortClose({
        year, run, runState: RUN_STATES.STALE,
        reason: pending > 0 ? 'Pending transactions appeared after the snapshot' : 'Ledger changed after the snapshot',
      });
      throw new AppError(
        'The ledger changed after this close was approved, so the approval no longer matches. The year is open again - start the close again.',
        409
      );
    }

    // 3. Seal the hash into the audit chain (once).
    let log = await AuditLog.findOne({
      chamaId, action: AUDIT_ACTIONS.YEAR_END_CLOSED, resourceType: AUDIT_RESOURCE_TYPE, resourceId: run._id,
    });
    if (!log) {
      log = await createAuditLog({
        actorUserId: userId, scopeType: 'CHAMA', chamaId,
        action: AUDIT_ACTIONS.YEAR_END_CLOSED,
        resourceType: AUDIT_RESOURCE_TYPE, resourceId: run._id,
        after: {
          year_id: String(year._id), period_start: year.start_date, period_end: year.end_date,
          snapshot_hash: run.snapshot_hash, row_count: run.row_count, summary: run.summary,
        },
        metadata: { approval_request_id: String(run.approval_request_id) },
      });
    }

    await YearEndClose.updateOne(
      { _id: run._id, state: RUN_STATES.PENDING_APPROVAL },
      { $set: {
        state: RUN_STATES.SEALED, sealed_at: new Date(), sealed_by: userId,
        audit_log_id: log._id, audit_sequence: log.sequence, audit_hash: log.hash,
      } }
    );
  } else if (run.state !== RUN_STATES.SEALED) {
    throw new AppError(`This close is ${run.state} and cannot be finalized.`, 409);
  }

  // 4. Flip the year (the old closeYear's only job, now the last step).
  if (effectiveState(year) === CLOSE_STATES.CLOSING) {
    year = await transitionYear({
      chamaId, yearId, from: CLOSE_STATES.CLOSING, to: CLOSE_STATES.CLOSED,
      set: { status: 'closed', closed_at: new Date(), closed_by: userId, updated_by: userId, sealed_hash: run.snapshot_hash },
    }).catch(async (e) => {
      // A concurrent finalize may have won; that is success for us.
      const now = await ChamaFinancialYear.findById(yearId);
      if (now && effectiveState(now) === CLOSE_STATES.CLOSED) return now;
      throw e;
    });
  }

  // 5. Seed the next year's opening balances, if it already exists. A failure
  //    here does not undo the close; it is retried when the next year starts
  //    its own close, or via the seed endpoint.
  let seeding = { seeded: 0 };
  let seedError = null;
  try {
    const next = await findNextYear(chamaId, year);
    if (next) seeding = await seedOpeningBalances({ chamaId, targetYear: next });
  } catch (e) {
    seedError = e.message;
  }

  return {
    year,
    close: await YearEndClose.findById(run._id),
    opening_seeded: seeding.seeded,
    opening_seed_error: seedError,
  };
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------
export const getCloseStatus = async ({ chamaId, yearId }) => {
  const year = await loadYear(chamaId, yearId);
  const run = year.current_close_id
    ? await YearEndClose.findById(year.current_close_id)
    : await YearEndClose.findOne({ year_id: yearId }).sort({ createdAt: -1 });
  const approval = run?.approval_request_id ? await ApprovalRequest.findById(run.approval_request_id) : null;
  return {
    year_id: year._id,
    state: effectiveState(year),
    close: run,
    approval: approval && {
      _id: approval._id, status: approval.status,
      required_approvals: approval.required_approvals,
      approved_count: approval.approvals.filter((a) => a.status === 'approved').length,
    },
  };
};

export const getCloseSnapshot = async ({ chamaId, yearId, closeId = null }) => {
  const year = await loadYear(chamaId, yearId);
  const id = closeId || year.current_close_id
    || (await YearEndClose.findOne({ year_id: yearId }).sort({ createdAt: -1 }))?._id;
  if (!id) throw new AppError('No year-end snapshot exists for this financial year.', 404);
  const close = await YearEndClose.findOne({ _id: id, chama_id: chamaId, year_id: yearId });
  if (!close) throw new AppError('Year-end close not found.', 404);
  const rows = await YearEndSnapshot.find({ close_id: close._id }).sort({ account_code: 1, name: 1 });
  return { close, rows };
};

// Independent check of a sealed close: rows still hash to the sealed hash, and
// the audit chain entry still carries that same hash.
export const verifySealedClose = async ({ chamaId, yearId }) => {
  const year = await loadYear(chamaId, yearId);
  const close = await YearEndClose.findOne({ year_id: yearId, chama_id: chamaId, state: RUN_STATES.SEALED });
  if (!close) throw new AppError('This financial year has no sealed close to verify.', 404);
  const stored = await verifyStoredSnapshot({ close, year });
  const log = close.audit_log_id ? await AuditLog.findById(close.audit_log_id).lean() : null;
  const auditHashMatches = Boolean(log) && log.after?.snapshot_hash === close.snapshot_hash;
  return {
    sealed_hash: close.snapshot_hash,
    rows_match_hash: stored.ok,
    audit_entry_found: Boolean(log),
    audit_hash_matches: auditHashMatches,
    audit_sequence: close.audit_sequence,
    ok: stored.ok && auditHashMatches,
  };
};

export { seedOpeningBalances };
