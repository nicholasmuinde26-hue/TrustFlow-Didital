import crypto from 'crypto';

// ========================================
// HASH CHAIN UTILITIES
// ========================================
//
// Shared by the audit log's hash-chaining (see services/audit.service.js
// and models/AuditLog.js). Each audit entry stores
// sha256(prevEntryHash + this entry's own content) as its own hash, and
// the next entry links to it the same way. Re-walking a chama's chain
// and recomputing every hash from the stored content proves nothing in
// that chain was edited or removed after the fact without also breaking
// the chain visibly - tampering stops being "undetectable if nobody
// happens to notice" and becomes "the recomputed hash won't match,
// immediately, for anyone who checks".
//
// ========================================


// ========================================
// STABLE STRINGIFY
// ========================================
//
// Plain JSON.stringify preserves whatever key order the object happened
// to be built in, which is NOT guaranteed to be identical between the
// write path and a later verification pass reading the same data back
// out of Mongo (driver/BSON key ordering, lean() vs hydrated docs,
// etc). Recursively sorting object keys before stringifying makes the
// hash input byte-for-byte reproducible regardless of how the object
// was assembled, which is the actual property a tamper-evidence hash
// needs - not "looks like JSON", but "always serializes the same way
// for the same logical content".
//
// ========================================

export const stableStringify = (value) => {
  if (value === undefined) {
    return 'null';
  }

  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  // Mongoose/BSON types (ObjectId, Decimal128, Long, ...) carry their
  // real value in an internal buffer whose shape can differ between a
  // freshly-constructed instance (write path) and one deserialized back
  // out of Mongo via .lean() (verification path), even for the exact
  // same logical value. Serializing their canonical string form instead
  // of walking their internal fields keeps the hash stable across that
  // round trip - audit `before`/`after` snapshots routinely carry
  // Decimal128 money amounts, so this matters in practice, not just in
  // theory.
  if (typeof value.toHexString === 'function') {
    return JSON.stringify(value.toHexString());
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  const bsonTypeName = value._bsontype || value.constructor?.name;
  if (
    (bsonTypeName === 'Decimal128' || bsonTypeName === 'Long' || bsonTypeName === 'Binary') &&
    typeof value.toString === 'function'
  ) {
    return JSON.stringify(value.toString());
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  const entries = keys.map(
    (key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`
  );

  return `{${entries.join(',')}}`;
};


// ========================================
// NORMALIZE A HASHED SNAPSHOT
// ========================================
//
// The hash is computed BEFORE the document is handed to Mongo, and
// recomputed AFTER reading it back. Those two representations must be
// identical or every entry fails verification for reasons that have
// nothing to do with tampering. Two things break that on their own:
//
//   1. Hydrated Mongoose documents. Callers pass things like
//      `after: loan` or `before: membership.toObject()` inconsistently.
//      A hydrated doc's own enumerable keys are internals ($__, _doc,
//      $isNew), so hashing it directly hashes internals - while Mongo
//      stores the *serialized* form. toObject() up front makes both
//      sides agree.
//
//   2. `undefined` values. Mongo drops keys whose value is undefined on
//      write, so `{ status: undefined }` comes back as `{}`. Stripping
//      them here means the write-path hash covers the same key set the
//      database will actually hold.
//
// This runs on before/after/metadata only - the Mixed fields callers
// fill with arbitrary shapes. The typed scalar fields don't need it.
//
// ========================================

const isEmptyPlainObject = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  !(value instanceof Date) &&
  !value._bsontype &&
  typeof value.toHexString !== 'function' &&
  Object.keys(value).length === 0;


export const normalizeSnapshot = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'object') {
    return value;
  }

  // BSON/date leaf types pass through untouched - stableStringify knows
  // how to serialize them canonically and they have no `undefined` keys
  // to strip. Checked before toObject() because some of them define it.
  if (
    typeof value.toHexString === 'function' ||
    value instanceof Date ||
    value._bsontype
  ) {
    return value;
  }

  if (typeof value.toObject === 'function') {
    return normalizeSnapshot(value.toObject());
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeSnapshot(item));
  }

  const out = {};
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) {
      continue;
    }

    const normalized = normalizeSnapshot(value[key]);

    // Mongoose `minimize` (on by default) drops empty objects at any
    // depth on write, so hashing one would guarantee a mismatch on the
    // way back out - a clean entry reported as tampered. Dropping it
    // here, before both hashing and storing, keeps the two identical.
    // Note this only removes what Mongo would have removed anyway, so
    // it can never mask a real edit.
    if (isEmptyPlainObject(normalized)) {
      continue;
    }

    out[key] = normalized;
  }

  // Same rule at the top level: a snapshot that is empty (or became
  // empty once its undefined keys were dropped) isn't stored as `{}`,
  // it simply isn't stored - so it must hash as null, not as `{}`.
  return isEmptyPlainObject(out) ? null : out;
};


// ========================================
// SHA-256 HEX
// ========================================

export const sha256Hex = (input) =>
  crypto.createHash('sha256').update(input, 'utf8').digest('hex');


// ========================================
// HASH A CHAIN ENTRY
// ========================================
//
// `prevHash` is the previous entry's hash (or the fixed GENESIS_HASH
// sentinel for the first entry in a chain). `payload` is the plain
// object of the entry's own content - identical to what gets stored, so
// re-hashing stored data reproduces the same result.
//
// ========================================

export const GENESIS_HASH = 'GENESIS';

export const hashChainEntry = (prevHash, payload) =>
  sha256Hex(`${prevHash || GENESIS_HASH}:${stableStringify(payload)}`);


// ========================================
// BUILD THE HASHED PAYLOAD FOR AN ENTRY
// ========================================
//
// Single source of truth for *which* fields the hash covers, used by
// all three writers: createAuditLog (write path), verifyAuditChain
// (read path), and the backfill script. If these three ever disagree
// about the field list - even by one field - every entry written by one
// fails verification under another, and it looks exactly like tampering.
// Keeping it in one function is what stops that.
//
// `createdAt`/`updatedAt` are deliberately NOT covered: they're assigned
// by Mongoose at insert time, after this payload is built, so the write
// path cannot know them. Ordering is still pinned by `sequence`, which
// IS covered and IS unique per scope.
//
// ========================================

export const buildAuditHashPayload = (entry) => ({
  _id: entry._id,
  actorUserId: entry.actorUserId ?? null,
  isSystemGenerated: Boolean(entry.isSystemGenerated),
  scopeType: entry.scopeType,
  chamaId: entry.chamaId ?? null,
  contributionGroupId: entry.contributionGroupId ?? null,
  action: entry.action,
  resourceType: entry.resourceType,
  resourceId: entry.resourceId,
  before: normalizeSnapshot(entry.before),
  after: normalizeSnapshot(entry.after),
  metadata: normalizeSnapshot(entry.metadata),
  sequence: entry.sequence,
});