import AppError from '../../utils/AppError.js';
import { formatPhone } from '../../utils/phone.js';

export const assertMemberCanRejoin = (membership, now = new Date(), cooldownDays = 30) => {
  if (!membership) return;
  if (membership.status === 'active') throw new AppError('You are already a member of this Chama', 409);
  if (membership.status === 'pending') throw new AppError('Your request to join this Chama is already pending approval', 409);
  if (membership.status === 'suspended') throw new AppError('Your membership is suspended. Contact a chama official to resolve the suspension before rejoining.', 403);
  if (membership.status === 'removed') {
    const removedAt = membership.removed_at ? new Date(membership.removed_at).getTime() : null;
    const cooldownEnds = removedAt === null ? Infinity : removedAt + cooldownDays * 86400000;
    if (now.getTime() < cooldownEnds) throw new AppError(`A ${cooldownDays}-day rejoin cooldown applies after removal. Contact a chama official if you need an earlier re-admission.`, 403);
  }
};

export const assertInvitePhoneMatches = (invitePhone, accountPhone) => {
  if (!invitePhone) return;
  let normalizedAccountPhone;
  try { normalizedAccountPhone = formatPhone(accountPhone); } catch { normalizedAccountPhone = null; }
  if (invitePhone !== normalizedAccountPhone) throw new AppError('This invitation was issued to a different phone number', 403);
};

export const assertInviteRoleAllowed = (role) => {
  if (role && role !== 'member') throw new AppError('Invite links can only request a standard member role. Assign official roles after the member is active.', 400);
};
