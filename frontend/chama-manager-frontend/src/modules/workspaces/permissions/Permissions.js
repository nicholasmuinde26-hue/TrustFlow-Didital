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

// Burial Chamas are Chama documents underneath (same ChamaMembership
// model/role vocabulary, same governance routes) — just with an extra
// BurialChamaProfile layered on top. Anything gated on "is this a
// Chama-backed workspace" should treat both types the same.
const CHAMA_BACKED_TYPES = ["chama", "burial-chama"];
const isChamaBacked = (type) => CHAMA_BACKED_TYPES.includes(type);

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
  if (isChamaBacked(type)) {
    return CHAMA_ROLES;
  }

  return ["member", "co_organizer"];
}

function isManager(role, type) {
  if (role === "super_admin" || role === "sub_admin") {
    return true;
  }

  if (isChamaBacked(type)) {
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

// Restrict member management (role reassignment, suspension, removal) to chairperson only
export function canManageMembersAsChairperson(role, type) {
  if (!isChamaBacked(type)) {
    return false;
  }
  return role === "chairperson";
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
  if (!isChamaBacked(type)) {
    return false;
  }

  return isSelf || isManager(role, type);
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

// Announcement approval — mirrors ANNOUNCEMENT_APPROVER_ROLES in
// backend/src/modules/announcements/announcement.controller.js.
// For a gated type, only these roles can post an announcement
// directly; anyone else with manage rights (Treasurer in a Chama,
// Co-organizer in a Contribution Group — Organizer is the sole
// primary owner, see the header comment above) has their post held
// as "pending" until an approver role signs off. Business has no
// entry, so it always publishes immediately.
const ANNOUNCEMENT_APPROVER_ROLES = {
  chama: ["chairperson", "secretary"],
  "contribution-group": ["organizer"],
};

export function canApproveAnnouncement(role, type) {
  const approverRoles = ANNOUNCEMENT_APPROVER_ROLES[type];
  return !!approverRoles && approverRoles.includes(role);
}

// Does creating an announcement as this role require an approver's
// sign-off before it's visible to the workspace?
export function announcementNeedsApproval(role, type) {
  const approverRoles = ANNOUNCEMENT_APPROVER_ROLES[type];
  return !!approverRoles && !approverRoles.includes(role);
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

// Chama-only: every MGR (Merry-Go-Round) mutation route on the backend —
// create/activate policy, reorder rotation, record a payment, propose a
// payout, disburse — is gated by requireChamaTreasurer(), which checks
// membership.role === 'treasurer' exactly (no chairperson fallback, unlike
// canDisburseLoan above). Keep this strict so the UI never offers an action
// the API will 403 on. Approval sign-off is intentionally NOT gated by this
// helper — eligibility for that is per-policy (approval_rule.eligible_roles)
// and enforced server-side in approval.service.js.
export function canManageMgr(role, type) {
  return type === "chama" && role === "treasurer";
}

// Chama-only: Savings Share-Out policy CRUD (create/update/activate/archive)
// and triggering a share-out are gated by requireChamaTreasurerOrChairperson()
// on the backend — either official can run this module, unlike the strict
// treasurer-only MGR gate above.
export function canManageSavingsShareout(role, type) {
  return type === "chama" && isManager(role, "chama");
}

// Chama-only: approving a pending_approval share-out is Chairperson-only
// on the backend (PATCH .../savings-shareouts/:id/approve).
export function canApproveSavingsShareout(role, type) {
  return type === "chama" && role === "chairperson";
}

// Chama-only: marking an individual share-out line item as paid is
// Treasurer-only on the backend (PATCH .../items/:itemId/pay).
export function canPaySavingsShareoutItem(role, type) {
  return type === "chama" && role === "treasurer";
}