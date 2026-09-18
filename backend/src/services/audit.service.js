import mongoose from 'mongoose';

import AuditLog from '../models/AuditLog.js';
import AuditChainState from '../models/Auditchainstate.js';

import AppError from '../utils/AppError.js';

import {
  hashChainEntry,
  buildAuditHashPayload,
  normalizeSnapshot,
} from '../utils/hashChain.js';


// ========================================
// AUDIT SCOPE TYPES
// ========================================

const AUDIT_SCOPE_TYPES = {

  CHAMA:
    'CHAMA',

  CONTRIBUTION_GROUP:
    'CONTRIBUTION_GROUP'

};


// ========================================
// VALIDATE OBJECT ID
// ========================================

const validateObjectId = (
  value,
  fieldName
) => {

  if (
    !value ||
    !mongoose.Types.ObjectId.isValid(value)
  ) {

    throw new AppError(
      `Invalid ${fieldName}`,
      400
    );

  }

};


// ========================================
// NORMALIZE AN ID
// ========================================
//
// Callers pass IDs both ways - `chama._id` (an ObjectId) from service
// code, `req.params.chamaId` (a string) from controller-adjacent code -
// and Mongoose casts strings to ObjectId on save, so the value handed
// in is not always the value stored.
//
// For the hash specifically this is already safe: stableStringify()
// serializes an ObjectId as its canonical hex string, which is
// byte-identical to how it serializes the same id passed as a string.
// That equivalence is asserted in tests/auditHashChain.test.js so it
// stays true.
//
// Casting here is therefore belt-and-braces rather than load-bearing.
// It is kept because it makes one property literally true instead of
// true-by-argument: every value in auditData is the value that gets
// stored. The fields below where that genuinely IS load-bearing -
// `resourceType` (schema trims), `isSystemGenerated` (schema coerces to
// Boolean), `action` (schema uppercases and trims) - are normalized on
// the same principle, and those would produce real, silent verification
// failures if left raw.
//
// ========================================

const toObjectId = (value) => {

  if (
    value === null ||
    value === undefined
  ) {

    return null;

  }

  if (
    value instanceof mongoose.Types.ObjectId
  ) {

    return value;

  }

  return new mongoose.Types.ObjectId(String(value));

};


// ========================================
// APPEND TO CHAIN
// ========================================
//
// Atomically claims the next sequence number in a scope's hash chain,
// computes this entry's hash from the previous entry's hash + this
// entry's own content, and persists both in the same compare-and-swap
// write - so no other writer can ever observe or build on a half-
// updated chain state (no window where sequence has advanced but
// lastHash hasn't caught up yet).
//
// Uses optimistic concurrency rather than a multi-document transaction
// because standalone MongoDB (e.g. local dev, some single-node
// deployments) doesn't support transactions at all - see the
// `canUseTransactions()` guard used throughout the finance/mgr/payout
// services for the same reason. A single-document update is always
// atomic regardless of topology, so this works everywhere the rest of
// the app already runs.
//
// How it stays race-free: each attempt reads the current (sequence,
// lastHash), computes what the new state WOULD be, then writes it back
// with a filter that requires both fields to still match what was just
// read. If another writer's CAS won in between, this one matches zero
// documents and retries against the now-current state - so two
// concurrent writers for the same scope can never both build their
// entry on the same prevHash, and no reader ever sees a state where the
// sequence number and lastHash are out of step with each other.
//
// `buildPayload(sequence)` returns the plain object to hash for this
// entry, given its now-known sequence number - the caller supplies this
// instead of a fixed object because the entry's own hash must cover its
// sequence number too.
//
// ========================================

const MAX_CHAIN_APPEND_ATTEMPTS = 8;

// ========================================
// RELEASE A CLAIMED CHAIN TIP
// ========================================
//
// The sequence number is claimed BEFORE the audit entry is inserted -
// it has to be, because the entry stores the hash that claiming it
// produces. If that insert then fails (validation, write concern, a
// dropped connection), the chain state is left pointing at an entry
// that was never written, and every later verification reports a gap:
// an untampered database accused of tampering.
//
// This compensating update hands the claim back, but ONLY if this
// writer's tip is still current. If another writer has already appended
// on top of it, the gap is real and permanent and verification should
// keep flagging it - quietly closing a hole where a lost entry used to
// be is precisely what a tamper-evident log must never do.
//
// ========================================

const releaseChainTip = async ({
  scopeFilter,
  sequence,
  hash,
  prevHash,
}) => {

  try {

    await AuditChainState.updateOne(
      { ...scopeFilter, sequence, lastHash: hash },
      { $set: { sequence: sequence - 1, lastHash: prevHash } }
    );

  } catch {

    // Best-effort by design: a failed rollback leaves a detectable gap,
    // which is the safe direction to fail in.

  }

};


const appendToChain = async ({
  scopeType,
  chamaId,
  contributionGroupId,
  buildPayload,
  session = null,
}) => {
  const scopeFilter = {
    scopeType,
    chamaId: chamaId || null,
    contributionGroupId: contributionGroupId || null,
  };

  for (let attempt = 0; attempt < MAX_CHAIN_APPEND_ATTEMPTS; attempt += 1) {
    // Ensure a chain-state doc exists for this scope (first-ever entry).
    // upsert is safe to race on its own - the unique index on
    // AuditChainState absorbs a duplicate-insert race, and the fresh
    // read below picks up whichever document actually won.
    const current =
      (await AuditChainState.findOne(scopeFilter, null, { session })) ||
      (await AuditChainState.findOneAndUpdate(
        scopeFilter,
        { $setOnInsert: { sequence: 0, lastHash: null } },
        { new: true, upsert: true, session }
      ));

    const nextSequence = current.sequence + 1;
    const prevHash = current.lastHash;
    const hash = hashChainEntry(prevHash, buildPayload(nextSequence));

    const result = await AuditChainState.updateOne(
      { ...scopeFilter, sequence: current.sequence, lastHash: current.lastHash },
      { $set: { sequence: nextSequence, lastHash: hash } },
      { session }
    );

    // matchedCount 0 means another writer's CAS already moved this
    // scope's state past what we just read - retry against fresh state.
    if (!result || result.matchedCount === 0) {
      continue;
    }

    return { sequence: nextSequence, prevHash, hash, scopeFilter };
  }

  throw new AppError(
    'Could not append to audit chain - too much concurrent write contention',
    500
  );
};


// ========================================
// CREATE AUDIT LOG
// ========================================
//
// CENTRALIZED AUDIT SERVICE
//
// Supports:
//
// 1. Chama operations
// 2. Contribution Group operations
//
// Every audit log belongs to exactly one
// audit scope.
//
// CHAMA
//
// OR
//
// CONTRIBUTION_GROUP
//
// This service should be called by business
// services AFTER successful operations.
//
// ========================================

export const createAuditLog = async ({

  actorUserId,

  // Background jobs/sweeps pass isSystemGenerated: true with no
  // actorUserId instead of an invalid/fabricated actor. Human-initiated
  // audit logs must not set this — actorUserId stays required for those.
  isSystemGenerated =
    false,

  scopeType,

  chamaId =
    null,

  contributionGroupId =
    null,

  action,

  resourceType,

  resourceId,

  before =
    null,

  after =
    null,

  metadata =
    null,

  session =
    null

}) => {

  // ======================================
  // 1. VALIDATE ACTOR
  // ======================================

  if (
    isSystemGenerated
  ) {

    // A system-generated entry must NOT also claim a human actor — that
    // would misattribute an automated action to whoever's ID was passed.
    if (
      actorUserId
    ) {

      throw new AppError(
        'System-generated audit logs cannot also specify an actor user ID',
        500
      );

    }

  } else {

    validateObjectId(
      actorUserId,
      'actor user ID'
    );

  }


  // ======================================
  // 2. VALIDATE SCOPE TYPE
  // ======================================

  if (
    !scopeType ||
    typeof scopeType !== 'string'
  ) {

    throw new AppError(
      'Audit scope type is required',
      500
    );

  }


  const normalizedScopeType =
    scopeType.toUpperCase();


  if (
    !Object.values(
      AUDIT_SCOPE_TYPES
    ).includes(
      normalizedScopeType
    )
  ) {

    throw new AppError(
      'Invalid audit scope type',
      500
    );

  }


  // ======================================
  // 3. VALIDATE SCOPE
  // ======================================


  // --------------------------------------
  // CHAMA SCOPE
  // --------------------------------------

  if (
    normalizedScopeType ===
    AUDIT_SCOPE_TYPES.CHAMA
  ) {

    // Chama ID required

    if (
      !chamaId
    ) {

      throw new AppError(
        'Chama ID is required for CHAMA audit logs',
        500
      );

    }


    // Contribution Group ID forbidden

    if (
      contributionGroupId
    ) {

      throw new AppError(
        'Contribution Group ID cannot be used with CHAMA audit logs',
        500
      );

    }


    // Validate Chama ID

    validateObjectId(
      chamaId,
      'Chama ID'
    );

  }


  // --------------------------------------
  // CONTRIBUTION GROUP SCOPE
  // --------------------------------------

  if (
    normalizedScopeType ===
    AUDIT_SCOPE_TYPES.CONTRIBUTION_GROUP
  ) {

    // Contribution Group ID required

    if (
      !contributionGroupId
    ) {

      throw new AppError(
        'Contribution Group ID is required for CONTRIBUTION_GROUP audit logs',
        500
      );

    }


    // Chama ID forbidden

    if (
      chamaId
    ) {

      throw new AppError(
        'Chama ID cannot be used with CONTRIBUTION_GROUP audit logs',
        500
      );

    }


    // Validate Contribution Group ID

    validateObjectId(
      contributionGroupId,
      'Contribution Group ID'
    );

  }


  // ======================================
  // 4. VALIDATE RESOURCE ID
  // ======================================

  validateObjectId(
    resourceId,
    'resource ID'
  );


  // ======================================
  // 5. VALIDATE ACTION
  // ======================================

  if (
    !action ||
    typeof action !== 'string'
  ) {

    throw new AppError(
      'Audit action is required',
      500
    );

  }


  // ======================================
  // 6. VALIDATE RESOURCE TYPE
  // ======================================

  if (
    !resourceType ||
    typeof resourceType !== 'string'
  ) {

    throw new AppError(
      'Audit resource type is required',
      500
    );

  }


  // ======================================
  // 7. BUILD AUDIT DATA
  // ======================================

  // Generated up front (rather than left to Mongo on insert) so it can
  // be included in the hashed payload below - the entry's hash then
  // covers its own _id too, not just its business fields.
  const auditLogId = new mongoose.Types.ObjectId();

  // Every value below is stored EXACTLY as hashed. See toObjectId() and
  // normalizeSnapshot() for why that equality has to be forced rather
  // than assumed.
  const auditData = {

    _id:
      auditLogId,

    actorUserId:
      toObjectId(actorUserId),

    isSystemGenerated:
      Boolean(isSystemGenerated),

    scopeType:
      normalizedScopeType,

    chamaId:
      toObjectId(chamaId),

    contributionGroupId:
      toObjectId(contributionGroupId),

    // Schema declares `uppercase: true, trim: true` - applying both
    // here keeps the hashed value and the stored value identical.
    action:
      action.trim().toUpperCase(),

    // Schema declares `trim: true`; trimming here keeps the hashed
    // value and the stored value identical.
    resourceType:
      resourceType.trim(),

    resourceId:
      toObjectId(resourceId),

    before:
      normalizeSnapshot(before),

    after:
      normalizeSnapshot(after),

    metadata:
      normalizeSnapshot(metadata)

  };


  // ======================================
  // 7b. APPEND TO HASH CHAIN
  // ======================================
  //
  // See appendToChain() above. Scoped per-chama / per-contribution-group
  // (not one global chain) so each group's trail can be walked and
  // verified independently of every other group's activity.
  //
  // ======================================

  const {
    sequence,
    prevHash,
    hash,
    scopeFilter,
  } = await appendToChain({
    scopeType: normalizedScopeType,
    chamaId: auditData.chamaId,
    contributionGroupId: auditData.contributionGroupId,
    session,
    buildPayload: (nextSequence) => buildAuditHashPayload({
      ...auditData,
      sequence: nextSequence,
    }),
  });

  auditData.sequence = sequence;
  auditData.prevHash = prevHash;
  auditData.hash = hash;


  // ======================================
  // 8. CREATE USING TRANSACTION SESSION
  // ======================================
  //
  // A caller-supplied session means the chain-state update above ran
  // inside that same transaction, so an abort rolls the claimed
  // sequence number back along with everything else - no compensating
  // write needed, or wanted, on this path.
  //
  // ======================================

  if (
    session
  ) {

    const [
      auditLog
    ] =
      await AuditLog.create(

        [
          auditData
        ],

        {
          session
        }

      );


    return auditLog;

  }


  // ======================================
  // 9. NORMAL CREATION
  // ======================================
  //
  // No transaction to fall back on here, so a failed insert has to hand
  // the claimed sequence number back explicitly - see releaseChainTip()
  // above for why silence would be worse than the error.
  //
  // ======================================

  try {

    return await AuditLog.create(
      auditData
    );

  } catch (error) {

    await releaseChainTip({
      scopeFilter,
      sequence,
      hash,
      prevHash,
    });

    throw error;

  }

};


// ========================================
// BUILD PAGINATION
// ========================================

const getPagination = ({

  page =
    1,

  limit =
    20

}) => {

  const currentPage =
    Math.max(

      Number(page) || 1,

      1

    );


  const pageLimit =
    Math.min(

      Math.max(

        Number(limit) || 20,

        1

      ),

      100

    );


  const skip =
    (
      currentPage -
      1
    ) *
    pageLimit;


  return {

    currentPage,

    pageLimit,

    skip

  };

};


// ========================================
// APPLY COMMON AUDIT FILTERS
// ========================================

const applyAuditFilters = ({

  query,

  action,

  actorUserId,

  resourceType,

  resourceId,

  startDate,

  endDate

}) => {


  // ======================================
  // ACTION
  // ======================================

  if (
    action
  ) {

    query.action =
      action.toUpperCase();

  }


  // ======================================
  // ACTOR
  // ======================================

  if (
    actorUserId
  ) {

    validateObjectId(
      actorUserId,
      'actor user ID'
    );


    query.actorUserId =
      actorUserId;

  }


  // ======================================
  // RESOURCE TYPE
  // ======================================

  if (
    resourceType
  ) {

    query.resourceType =
      resourceType;

  }


  // ======================================
  // RESOURCE ID
  // ======================================

  if (
    resourceId
  ) {

    validateObjectId(
      resourceId,
      'resource ID'
    );


    query.resourceId =
      resourceId;

  }


  // ======================================
  // DATE FILTERING
  // ======================================

  if (
    startDate ||
    endDate
  ) {

    query.createdAt = {};

  }


  // --------------------------------------
  // START DATE
  // --------------------------------------

  if (
    startDate
  ) {

    const start =
      new Date(
        startDate
      );


    if (
      Number.isNaN(
        start.getTime()
      )
    ) {

      throw new AppError(
        'Invalid start date',
        400
      );

    }


    query.createdAt.$gte =
      start;

  }


  // --------------------------------------
  // END DATE
  // --------------------------------------

  if (
    endDate
  ) {

    const end =
      new Date(
        endDate
      );


    if (
      Number.isNaN(
        end.getTime()
      )
    ) {

      throw new AppError(
        'Invalid end date',
        400
      );

    }


    // Include complete end day.

    end.setHours(

      23,

      59,

      59,

      999

    );


    query.createdAt.$lte =
      end;

  }


  return query;

};


// ========================================
// EXECUTE AUDIT LOG QUERY
// ========================================

const executeAuditLogQuery = async ({

  query,

  page,

  limit

}) => {

  // --------------------------------------
  // Pagination
  // --------------------------------------

  const {

    currentPage,

    pageLimit,

    skip

  } =
    getPagination({

      page,

      limit

    });


  // --------------------------------------
  // Execute queries
  // --------------------------------------

  const [

    logs,

    total

  ] = await Promise.all([

    AuditLog

      .find(
        query
      )

      .populate(

        'actorUserId',

        'name phone email'

      )

      .populate(

        'chamaId',

        'name status'

      )

      .populate(

        'contributionGroupId',

        'name status'

      )

      .sort({

        createdAt:
          -1

      })

      .skip(
        skip
      )

      .limit(
        pageLimit
      )

      .lean(),


    AuditLog

      .countDocuments(
        query
      )

  ]);


  // --------------------------------------
  // Pagination
  // --------------------------------------

  const totalPages =
    Math.ceil(

      total /
      pageLimit

    );


  return {

    logs,

    pagination: {

      page:
        currentPage,

      limit:
        pageLimit,

      total,

      totalPages,

      hasNextPage:
        currentPage <
        totalPages,

      hasPreviousPage:
        currentPage >
        1

    }

  };

};


// ========================================
// GET AUDIT LOGS FOR CHAMA
// ========================================
//
// Used by:
//
// Treasurer
// Auditor
//
// ========================================

export const getChamaAuditLogs = async ({

  chamaId,

  page =
    1,

  limit =
    20,

  action,

  actorUserId,

  resourceType,

  resourceId,

  startDate,

  endDate

}) => {

  // --------------------------------------
  // Validate Chama ID
  // --------------------------------------

  validateObjectId(
    chamaId,
    'Chama ID'
  );


  // --------------------------------------
  // Build query
  // --------------------------------------

  const query = {

    scopeType:
      AUDIT_SCOPE_TYPES.CHAMA,

    chamaId

  };


  // --------------------------------------
  // Apply filters
  // --------------------------------------

  applyAuditFilters({

    query,

    action,

    actorUserId,

    resourceType,

    resourceId,

    startDate,

    endDate

  });


  // --------------------------------------
  // Execute
  // --------------------------------------

  return executeAuditLogQuery({

    query,

    page,

    limit

  });

};


// ========================================
// GET AUDIT LOGS FOR CONTRIBUTION GROUP
// ========================================
//
// Used by:
//
// Organizer
// Co-organizer
//
// ========================================

export const getContributionGroupAuditLogs = async ({

  contributionGroupId,

  page =
    1,

  limit =
    20,

  action,

  actorUserId,

  resourceType,

  resourceId,

  startDate,

  endDate

}) => {

  // --------------------------------------
  // Validate Contribution Group ID
  // --------------------------------------

  validateObjectId(

    contributionGroupId,

    'Contribution Group ID'

  );


  // --------------------------------------
  // Build query
  // --------------------------------------

  const query = {

    scopeType:
      AUDIT_SCOPE_TYPES.CONTRIBUTION_GROUP,

    contributionGroupId

  };


  // --------------------------------------
  // Apply filters
  // --------------------------------------

  applyAuditFilters({

    query,

    action,

    actorUserId,

    resourceType,

    resourceId,

    startDate,

    endDate

  });


  // --------------------------------------
  // Execute
  // --------------------------------------

  return executeAuditLogQuery({

    query,

    page,

    limit

  });

};


// ========================================
// GET AUDIT LOG BY ID
// ========================================
//
// Works for:
//
// Chama
//
// OR
//
// Contribution Group
//
// ========================================

export const getAuditLogById = async ({

  chamaId =
    null,

  contributionGroupId =
    null,

  auditLogId

}) => {

  // --------------------------------------
  // Validate Audit Log ID
  // --------------------------------------

  validateObjectId(

    auditLogId,

    'audit log ID'

  );


  // --------------------------------------
  // Validate Scope
  // --------------------------------------

  if (
    !chamaId &&
    !contributionGroupId
  ) {

    throw new AppError(

      'Chama ID or Contribution Group ID is required',

      400

    );

  }


  // --------------------------------------
  // Prevent Multiple Scopes
  // --------------------------------------

  if (
    chamaId &&
    contributionGroupId
  ) {

    throw new AppError(

      'Provide only one audit scope',

      400

    );

  }


  // --------------------------------------
  // Build Base Query
  // --------------------------------------

  const query = {

    _id:
      auditLogId

  };


  // ======================================
  // CHAMA SCOPE
  // ======================================

  if (
    chamaId
  ) {

    validateObjectId(

      chamaId,

      'Chama ID'

    );


    query.scopeType =
      AUDIT_SCOPE_TYPES.CHAMA;


    query.chamaId =
      chamaId;

  }


  // ======================================
  // CONTRIBUTION GROUP SCOPE
  // ======================================

  if (
    contributionGroupId
  ) {

    validateObjectId(

      contributionGroupId,

      'Contribution Group ID'

    );


    query.scopeType =
      AUDIT_SCOPE_TYPES.CONTRIBUTION_GROUP;


    query.contributionGroupId =
      contributionGroupId;

  }


  // ======================================
  // FIND AUDIT LOG
  // ======================================

  const auditLog =
    await AuditLog

      .findOne(
        query
      )

      .populate(

        'actorUserId',

        'name phone email'

      )

      .populate(

        'chamaId',

        'name status'

      )

      .populate(

        'contributionGroupId',

        'name status'

      )

      .lean();


  // ======================================
  // CHECK EXISTENCE
  // ======================================

  if (
    !auditLog
  ) {

    throw new AppError(

      'Audit log not found',

      404

    );

  }


  // ======================================
  // RETURN
  // ======================================

  return auditLog;

};


// ========================================
// VERIFY CHAIN ENTRIES  (pure)
// ========================================
//
// Given a scope's entries already sorted by sequence, recompute the
// whole chain and report the first thing that doesn't add up. Split out
// from the database query below so it can be unit-tested against
// hand-built entries with no Mongo connection - see
// tests/auditHashChain.test.js.
//
// Three independent checks, each catching a different attack:
//
//   1. `sequence` runs 1..N with no gaps       -> catches DELETION
//   2. `prevHash` equals the previous `hash`   -> catches REORDERING
//                                                 and INSERTION
//   3. recomputed hash equals stored `hash`    -> catches EDITING
//
// A single edited field breaks check 3 at that entry, and because every
// later entry's hash was computed over that entry's hash, the damage is
// visible from that point forward rather than at one quietly-changed
// row. There is no edit that repairs itself.
//
// ========================================

export const verifyChainEntries = (entries) => {

  const result = {
    valid: true,
    totalEntries: entries.length,
    verifiedEntries: 0,
    brokenAtSequence: null,
    reason: null,
    chainTip: null,
  };

  let expectedPrevHash = null;
  let expectedSequence = 1;

  for (const entry of entries) {

    // Gap or duplicate sequence number - a row is missing, or something
    // wrote outside createAuditLog()'s chain-safe path entirely.
    if (entry.sequence !== expectedSequence) {
      result.valid = false;
      result.brokenAtSequence = expectedSequence;
      result.reason = `Expected sequence ${expectedSequence} but found ${entry.sequence}`;
      break;
    }

    // This entry's declared prevHash must equal the actual previous
    // entry's hash - catches deletion/reordering/insertion.
    if ((entry.prevHash || null) !== (expectedPrevHash || null)) {
      result.valid = false;
      result.brokenAtSequence = entry.sequence;
      result.reason = 'prevHash does not match the preceding entry\'s hash';
      break;
    }

    // Recompute this entry's own hash from its current stored content -
    // catches any edit to the entry itself.
    const recomputedHash = hashChainEntry(
      entry.prevHash,
      buildAuditHashPayload(entry)
    );

    if (recomputedHash !== entry.hash) {
      result.valid = false;
      result.brokenAtSequence = entry.sequence;
      result.reason = 'Stored hash does not match this entry\'s content';
      break;
    }

    result.verifiedEntries += 1;
    expectedPrevHash = entry.hash;
    expectedSequence += 1;

  }

  result.chainTip = expectedPrevHash;

  return result;

};


// ========================================
// VERIFY AUDIT CHAIN
// ========================================
//
// Walks one scope's full audit trail in sequence order and recomputes
// every entry's hash from its own stored content.
//
// Read-only: this never writes to AuditLog or AuditChainState. Safe to
// run on demand (e.g. from an auditor-facing "Verify integrity" action)
// or on a schedule.
//
// TAIL TRUNCATION:
// ----------------
// Checks 1-3 in verifyChainEntries() all pass on a chain whose LAST few
// entries were deleted - what's left is a shorter but internally
// consistent chain. The only record that those entries ever existed is
// the independently-stored tip in AuditChainState, so this compares
// against it and reports a mismatch explicitly. Chain state is mutable,
// so a thorough attacker rewrites it too; this catches the careless case
// and, more usefully, makes the careful case require tampering with two
// collections instead of one.
//
// ========================================

export const verifyAuditChain = async ({
  scopeType,
  chamaId = null,
  contributionGroupId = null,
}) => {

  const normalizedScopeType = String(scopeType || '').toUpperCase();

  if (!Object.values(AUDIT_SCOPE_TYPES).includes(normalizedScopeType)) {
    throw new AppError('Invalid audit scope type', 400);
  }

  const isChamaScope = normalizedScopeType === AUDIT_SCOPE_TYPES.CHAMA;

  if (isChamaScope) {
    validateObjectId(chamaId, 'Chama ID');
  } else {
    validateObjectId(contributionGroupId, 'Contribution Group ID');
  }

  const scopeFilter = {
    scopeType: normalizedScopeType,
    chamaId: isChamaScope ? toObjectId(chamaId) : null,
    contributionGroupId: isChamaScope ? null : toObjectId(contributionGroupId),
  };

  const entries = await AuditLog.find(scopeFilter)
    .sort({ sequence: 1 })
    .lean();

  const result = verifyChainEntries(entries);

  result.scopeType = normalizedScopeType;
  result.chamaId = scopeFilter.chamaId;
  result.contributionGroupId = scopeFilter.contributionGroupId;
  result.verifiedAt = new Date();


  // ======================================
  // TAIL CHECK AGAINST STORED CHAIN TIP
  // ======================================

  const chainState = await AuditChainState.findOne(scopeFilter).lean();

  result.expectedTotalEntries = chainState ? chainState.sequence : 0;
  result.expectedChainTip = chainState ? chainState.lastHash : null;

  result.tipMatchesChainState =
    (result.chainTip || null) === (result.expectedChainTip || null) &&
    result.totalEntries === result.expectedTotalEntries;

  if (result.valid && !result.tipMatchesChainState) {
    result.valid = false;
    result.brokenAtSequence = result.totalEntries + 1;
    result.reason =
      'Chain is internally consistent but ends before the recorded chain tip - entries appear to have been removed from the end';
  }

  return result;

};


// ========================================
// EXPORT AUDIT SCOPE TYPES
// ========================================

export {
  AUDIT_SCOPE_TYPES
};