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
  "committee_member",
  "patron",
];

export const CONTRIBUTION_GROUP_ROLES = [
  "member",
  "co_organizer",
  "organizer",
];

// Roles a manager is allowed to hand to another member. Deliberately
// excludes "organizer" for contribution groups.
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
  if (type === "chama") {
    return ["chairperson", "treasurer", "secretary"].includes(role);
  }
  return isManager(role, type);
}

export function canPinAnnouncement(role, type) {
  if (type === "chama") {
    return ["chairperson", "treasurer", "secretary"].includes(role);
  }
  return isManager(role, type);
}

export function canDeleteAnnouncement(role, type) {
  if (type === "chama") {
    return ["chairperson", "treasurer", "secretary"].includes(role);
  }
  return isManager(role, type);
}

export function canManageMeetings(role, type) {
  if (type === "chama") {
    return ["chairperson", "treasurer", "secretary"].includes(role);
  }
  return isManager(role, type);
}

// Chama: officials & committee members can call and manage polls
const CHAMA_POLL_OFFICIAL_ROLES = ["chairperson", "secretary", "treasurer", "committee_member"];

export function canManagePolls(role, type) {
  if (type === "chama") {
    return CHAMA_POLL_OFFICIAL_ROLES.includes(role);
  }
  return isManager(role, type);
}

// Contribution groups only — inviting/adding members and sending
// invitations is restricted to organizer/co_organizer; Chama has no
// invitation concept at all (see CHANGES doc).
export function canInviteMembers(role, type) {
  return type === "contribution-group" && isManager(role, type);
}

// ==========================================================
// SENSITIVE / MANAGEMENT-ONLY AREAS
//
// These gate whole pages (Command Center, Administration /
// Settings, the Loans Approval queue) rather than individual
// fields — a plain member shouldn't just be blocked from
// *editing* here, the section shouldn't be reachable or
// visible at all (no nav item, no route, redirected if the
// URL is visited directly).
// ==========================================================

// Chama-only: the Command Center is the officials' operational
// dashboard (assign officials, verify member KYC, review goals).
// Not a Contribution Group concept.
export function canViewCommandCenter(role, type) {
  return type === "chama" && isManager(role, "chama");
}

// Chama & Contribution Group: workspace-wide configuration and
// (for the Treasurer/organizer) deletion. Restricted to managers.
export function canViewAdministration(role, type) {
  return isManager(role, type);
}

// Chama-only: the dual loan-approval queue (approve/reject/
// disburse) is restricted to Chama officials — mirrors
// LOAN_OFFICIAL_ROLES in backend/src/modules/loans/Loan.constants.js.
// Broader than isManager() above: Secretary, Auditor, and Committee
// Member can also review/approve loans even though not all of them
// can edit Chama settings. Committee members matter especially for
// the conflict-of-interest recusal quorum (when the Chairperson or
// Treasurer is themself the applicant, other committee members fill
// the recused seat).
const LOAN_OFFICIAL_ROLES = ["treasurer", "chairperson", "secretary", "auditor", "committee_member"];

export function isLoanOfficial(role, type) {
  return type === "chama" && LOAN_OFFICIAL_ROLES.includes(role);
}

// Chama-only: initiating a disbursement once a loan is fully approved
// is normally Treasurer-only — mirrors requireDisburserRole() in
// backend/src/modules/loans/Loan.controller.js. The Chairperson is
// also allowed here because the Treasurer can never disburse their
// own loan: when the Treasurer is the applicant, the Chairperson is
// the authorized fallback disburser (the backend still enforces the
// precise per-loan rule via assertAuthorizedDisburser()).
export function canDisburseLoan(role, type) {
  return type === "chama" && ["treasurer", "chairperson"].includes(role);
}