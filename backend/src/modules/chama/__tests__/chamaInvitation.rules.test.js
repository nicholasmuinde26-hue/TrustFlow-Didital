import test from 'node:test';
import assert from 'node:assert/strict';
import ChamaInvitation from '../../../models/ChamaInvitation.js';
import { assertInvitePhoneMatches, assertInviteRoleAllowed, assertMemberCanRejoin } from '../chamaInvitation.rules.js';

test('invite links cannot grant an official role', () => {
  assert.doesNotThrow(() => assertInviteRoleAllowed('member'));
  assert.throws(() => assertInviteRoleAllowed('treasurer'), /standard member role/);
  assert.throws(() => assertInviteRoleAllowed('chairperson'), /standard member role/);
});

test('phone-bound invites reject a different account phone', () => {
  assert.doesNotThrow(() => assertInvitePhoneMatches('254712345678', '254712345678'));
  assert.throws(() => assertInvitePhoneMatches('254712345678', '254711111111'), /different phone number/);
  assert.doesNotThrow(() => assertInvitePhoneMatches(null, '254711111111'));
});

test('suspended members cannot rejoin through an invitation', () => {
  assert.throws(() => assertMemberCanRejoin({ status: 'suspended' }), /membership is suspended/);
});

test('removed members have a 30-day cooldown and can reapply afterward', () => {
  const now = new Date('2026-10-28T00:00:00.000Z');
  assert.throws(() => assertMemberCanRejoin({ status: 'removed', removed_at: '2026-10-01T00:00:00.000Z' }, now), /30-day rejoin cooldown/);
  assert.doesNotThrow(() => assertMemberCanRejoin({ status: 'removed', removed_at: '2026-09-01T00:00:00.000Z' }, now));
});

test('invite schema enforces member-only role and expiry cleanup metadata', async () => {
  const invite = new ChamaInvitation({ role: 'treasurer' });
  await assert.rejects(invite.validate(), /role/);
  const expiryIndex = ChamaInvitation.schema.indexes().find(([keys, options]) => keys.expires_at === 1 && options.expireAfterSeconds === 0);
  assert.ok(expiryIndex, 'expires_at has a TTL index');
  assert.ok(ChamaInvitation.schema.path('max_uses'));
  assert.ok(ChamaInvitation.schema.path('use_count'));
  assert.ok(ChamaInvitation.schema.path('revoked_at'));
  assert.ok(ChamaInvitation.schema.path('uses'));
});
