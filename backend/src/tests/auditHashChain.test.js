/**
 * ============================================================================
 * AUDIT HASH CHAIN — TAMPER DETECTION TESTS
 * ============================================================================
 *
 * Context
 * -------
 * AuditLog blocks updates and deletes at the schema level, which stops
 * tampering through the application. It does nothing about tampering
 * underneath the application — a `db.auditlogs.updateOne(...)` in a Mongo
 * shell, a restored-from-backup collection, a compromised operator account.
 * The hash chain is what covers that gap: each entry stores
 * sha256(previous entry's hash + its own content), so altering any entry
 * invalidates it and every entry after it.
 *
 * "We compute a hash" is easy to write and easy to get subtly wrong in ways
 * that produce a hash which never actually catches anything. These tests
 * assert the three properties that make the chain worth having:
 *
 *   1. It catches an EDIT     — a changed field in any entry
 *   2. It catches a DELETION  — a removed entry mid-chain
 *   3. It catches a REORDER   — two entries swapped
 *
 * ...plus the serialization properties the above quietly depend on, which
 * are the actual source of false positives in a system like this: if the
 * hash isn't reproducible across the write/read round trip, every entry
 * reports as tampered and the feature becomes noise people learn to ignore.
 *
 * These tests operate on hand-built entry objects and call the pure
 * verifyChainEntries() directly, so they run fast and do NOT require a
 * MongoDB connection.
 * ============================================================================
 */

import mongoose from 'mongoose';
import { verifyChainEntries } from '../services/audit.service.js';
import {
  hashChainEntry,
  buildAuditHashPayload,
  stableStringify,
  normalizeSnapshot,
} from '../utils/hashChain.js';


// --------------------------------------------------------------------
// TEST CHAIN BUILDER
// --------------------------------------------------------------------
//
// Builds a valid N-entry chain the same way createAuditLog() does:
// sequence 1..N, each entry's prevHash pointing at the previous entry's
// hash, each hash computed over buildAuditHashPayload(). Using the same
// shared helper the production write path uses is deliberate — a test
// that reimplemented the hashing would pass while production drifted.
//
// --------------------------------------------------------------------

const chamaId = new mongoose.Types.ObjectId();

const buildChain = (count) => {
  const entries = [];
  let prevHash = null;

  for (let i = 1; i <= count; i += 1) {
    const entry = {
      _id: new mongoose.Types.ObjectId(),
      actorUserId: new mongoose.Types.ObjectId(),
      isSystemGenerated: false,
      scopeType: 'CHAMA',
      chamaId,
      contributionGroupId: null,
      action: 'LOAN_APPROVED',
      resourceType: 'ChamaLoan',
      resourceId: new mongoose.Types.ObjectId(),
      before: { status: 'pending' },
      after: { status: 'approved', amount: 5000 * i },
      metadata: { ip: '10.0.0.1' },
      sequence: i,
      prevHash,
    };

    entry.hash = hashChainEntry(prevHash, buildAuditHashPayload(entry));
    prevHash = entry.hash;

    entries.push(entry);
  }

  return entries;
};


describe('audit hash chain', () => {

  // ------------------------------------------------------------------
  // BASELINE — an untampered chain verifies clean
  // ------------------------------------------------------------------
  test('an intact chain verifies as valid', () => {
    const result = verifyChainEntries(buildChain(5));

    expect(result.valid).toBe(true);
    expect(result.verifiedEntries).toBe(5);
    expect(result.brokenAtSequence).toBeNull();
    expect(result.chainTip).toEqual(expect.any(String));
  });


  // ------------------------------------------------------------------
  // TEST 1 — EDIT
  // ------------------------------------------------------------------
  // The case the whole feature exists for: someone quietly changes a
  // figure in a settled record. The amount on entry 3 changes from
  // 15000 to 1500 and nothing else is touched.
  // ------------------------------------------------------------------
  test('detects an edited field in a single entry', () => {
    const entries = buildChain(5);

    entries[2].after.amount = 1500;

    const result = verifyChainEntries(entries);

    expect(result.valid).toBe(false);
    expect(result.brokenAtSequence).toBe(3);
    expect(result.reason).toMatch(/does not match this entry/i);

    // The first two entries still verify — the break is located, not
    // just reported. An auditor can see exactly where the trail stops
    // being trustworthy.
    expect(result.verifiedEntries).toBe(2);
  });


  test('detects a changed actor on an entry', () => {
    const entries = buildChain(4);

    // Reassigning blame for an action — different field, same guarantee.
    entries[1].actorUserId = new mongoose.Types.ObjectId();

    const result = verifyChainEntries(entries);

    expect(result.valid).toBe(false);
    expect(result.brokenAtSequence).toBe(2);
  });


  // ------------------------------------------------------------------
  // TEST 2 — DELETION
  // ------------------------------------------------------------------
  test('detects a deleted entry in the middle of the chain', () => {
    const entries = buildChain(5);

    entries.splice(2, 1);

    const result = verifyChainEntries(entries);

    expect(result.valid).toBe(false);
    expect(result.brokenAtSequence).toBe(3);
    expect(result.reason).toMatch(/expected sequence 3/i);
  });


  // ------------------------------------------------------------------
  // TEST 3 — REORDER
  // ------------------------------------------------------------------
  // Swapping two entries preserves the set of sequence numbers, so a
  // naive "are all the numbers there" check passes. prevHash is what
  // catches it.
  // ------------------------------------------------------------------
  test('detects two entries swapped', () => {
    const entries = buildChain(5);

    const swapped = [
      entries[0],
      entries[2],
      entries[1],
      entries[3],
      entries[4],
    ];

    const result = verifyChainEntries(swapped);

    expect(result.valid).toBe(false);
    expect(result.brokenAtSequence).toBe(2);
  });


  // ------------------------------------------------------------------
  // TEST 4 — FORGED REPLACEMENT
  // ------------------------------------------------------------------
  // The sophisticated attempt: don't just edit the entry, recompute its
  // hash too so it's internally consistent. This is what the chain
  // specifically defeats — entry 3's new hash no longer matches what
  // entry 4 recorded as its prevHash, so the break just moves.
  // ------------------------------------------------------------------
  test('detects an edited entry even when its own hash is recomputed', () => {
    const entries = buildChain(5);

    entries[2].after.amount = 1;
    entries[2].hash = hashChainEntry(
      entries[2].prevHash,
      buildAuditHashPayload(entries[2])
    );

    const result = verifyChainEntries(entries);

    expect(result.valid).toBe(false);
    // Entry 3 now self-verifies, so the chain survives to 3 and breaks
    // at 4 — where the stale prevHash is.
    expect(result.brokenAtSequence).toBe(4);
    expect(result.reason).toMatch(/prevHash/i);
  });


  // ------------------------------------------------------------------
  // TEST 5 — SERIALIZATION STABILITY
  // ------------------------------------------------------------------
  // False positives are the real failure mode. If the same logical
  // content can hash two different ways, every entry reads as tampered
  // and the signal is worthless. Mongo does not guarantee key order is
  // preserved across a write/read round trip.
  // ------------------------------------------------------------------
  test('key order does not change the hash', () => {
    const a = { alpha: 1, beta: { x: 'one', y: 'two' }, gamma: [1, 2] };
    const b = { gamma: [1, 2], beta: { y: 'two', x: 'one' }, alpha: 1 };

    expect(stableStringify(a)).toBe(stableStringify(b));
    expect(hashChainEntry(null, a)).toBe(hashChainEntry(null, b));
  });


  test('array order DOES change the hash', () => {
    // Order-independence must not leak into arrays — reordering a list
    // of approvers is a real change to the record, not a serialization
    // artifact.
    expect(hashChainEntry(null, { list: [1, 2] }))
      .not.toBe(hashChainEntry(null, { list: [2, 1] }));
  });


  test('an ObjectId hashes the same as itself read back from Mongo', () => {
    // Mongoose hands back a differently-constructed ObjectId instance
    // for the same value after a round trip. Hashing the canonical hex
    // form rather than the internal buffer is what keeps these equal.
    const id = new mongoose.Types.ObjectId();
    const roundTripped = new mongoose.Types.ObjectId(id.toHexString());

    expect(hashChainEntry(null, { id })).toBe(hashChainEntry(null, { id: roundTripped }));
  });


  test('a string id and an ObjectId hash identically', () => {
    // Callers pass ids both ways — `chama._id` from service code, a
    // route-param string from controller-adjacent code — and Mongoose
    // stores only the cast ObjectId form. stableStringify() serializing
    // an ObjectId as its canonical hex string is what makes those two
    // inputs produce the same hash, so an entry written from a string id
    // still verifies after the round trip. If this ever stops holding,
    // every such entry silently reports as tampered.
    const id = new mongoose.Types.ObjectId();

    expect(hashChainEntry(null, { id }))
      .toBe(hashChainEntry(null, { id: id.toHexString() }));
  });


  test('a trailing space in resourceType changes the hash', () => {
    // This one IS load-bearing. AuditLog declares `trim: true` on
    // resourceType, so Mongo stores the trimmed value while an unnormalized
    // write path would hash the untrimmed one — a guaranteed false
    // "tampered" verdict. createAuditLog() trims before hashing for
    // exactly this reason; the same applies to action (uppercase + trim)
    // and isSystemGenerated (Boolean coercion).
    expect(hashChainEntry(null, { resourceType: 'ChamaLoan ' }))
      .not.toBe(hashChainEntry(null, { resourceType: 'ChamaLoan' }));
  });


  test('undefined values are stripped so the hash matches what Mongo stores', () => {
    // Mongo drops undefined-valued keys on write, so { a: 1, b: undefined }
    // comes back as { a: 1 }. normalizeSnapshot() makes the write-path
    // hash cover the same key set the database will actually hold.
    const withUndefined = normalizeSnapshot({ a: 1, b: undefined, c: { d: undefined, e: 2 } });
    const asStored = normalizeSnapshot({ a: 1, c: { e: 2 } });

    expect(hashChainEntry(null, withUndefined)).toBe(hashChainEntry(null, asStored));
  });


  test('a Date hashes stably across a round trip', () => {
    const when = new Date('2026-03-01T09:15:00.000Z');

    expect(hashChainEntry(null, { when }))
      .toBe(hashChainEntry(null, { when: new Date(when.toISOString()) }));
  });


  // ------------------------------------------------------------------
  // TEST 6 — EMPTY CHAIN
  // ------------------------------------------------------------------
  test('a scope with no audit entries verifies as valid and empty', () => {
    const result = verifyChainEntries([]);

    expect(result.valid).toBe(true);
    expect(result.totalEntries).toBe(0);
    expect(result.chainTip).toBeNull();
  });

});