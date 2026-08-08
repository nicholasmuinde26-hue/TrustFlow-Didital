// Workspace -> Membership -> Role -> Permissions -> UI
//
// Never check a role string directly in a component
// (if (role === "treasurer")). Route every permission decision through
// a function here instead. This is type-aware because the backend
// genuinely defines two different role vocabularies:
//
// Chama (ChamaMembership.role):
//   member | treasurer | secretary | auditor | chairperson
//   Manager = treasurer OR chairperson (see requireChamaTreasurerOrChairperson).
//   Both roles can update Chama settings, add/remove members, change a
//   member's role, and transfer the Treasurer role. Secretary and
//   Auditor are not managers for these purposes.
//
// Contribution Group (ContributionGroupMember.role):
//   member | co_organizer | organizer
//   Manager = organizer OR co_organizer (see requireContributionGroupManager).
//   Only the primary organizer (ContributionGroup.created_by) can change
//   group status or be treated as the sole owner — co_organizer is a
//   helper role, not equal to organizer.

export const CHAMA_ROLES = [
  "member",
  "treasurer",
  "secretary",
  "auditor",
  "chairperson",
];

export const CONTRIBUTION_GROUP_ROLES = [
  "member",
  "co_organizer",
  "organizer",
];

// Roles a manager is allowed to hand to another member. Deliberately
// excludes "organizer" for contribution groups — the backend's role-update
// endpoint only supports toggling member <-> co_organizer; organizer status
// follows ContributionGroup.created_by and isn't reassigned this way.
export function assignableRoles(type) {
  if (type === "chama") {
    return CHAMA_ROLES;
  }

  return ["member", "co_organizer"];
}

function isManager(role, type) {
  if (type === "chama") {
    return role === "treasurer" || role === "chairperson";
  }

  if (type === "contribution-group") {
    return role === "organizer" || role === "co_organizer";
  }

  return false;
}

export function canManageMembers(role, type) {
  return isManager(role, type);
}

// Chama-specific: updating core Chama settings (name, monthly savings,
// contribution cycle, fine amount, loan policy, etc.) is restricted to
// the Treasurer or Chairperson, same as member management.
export function canEditChamaSettings(role) {
  return isManager(role, "chama");
}

// Chama-only: members can edit their own profile; treasurer/chairperson
// can edit any member's profile (backend: PATCH .../members/:id/profile).
export function canEditMemberProfile(role, type, isSelf) {
  if (type !== "chama") {
    return false;
  }

  return isSelf || isManager(role, "chama");
}

export function canManageAnnouncements(role, type) {
  return isManager(role, type);
}

export function canPinAnnouncement(role, type) {
  return isManager(role, type);
}

export function canDeleteAnnouncement(role, type) {
  return isManager(role, type);
}

export function canManageMeetings(role, type) {
  return isManager(role, type);
}

// Contribution groups only — inviting/adding members and sending
// invitations is restricted to organizer/co_organizer; Chama has no
// invitation concept at all (see CHANGES doc).
export function canInviteMembers(role, type) {
  return type === "contribution-group" && isManager(role, type);
}