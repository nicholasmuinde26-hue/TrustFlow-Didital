// Workspace -> Membership -> Role -> Permissions -> UI
//
// Never check a role string directly in a component
// (if (user.role === "treasurer")). Route every permission
// decision through a function here instead, so the UI only ever
// asks "can this member do X in this workspace" — not "what is
// their role". That keeps the role vocabulary free to grow
// (chama roles vs contribution-group roles can differ) without
// touching every screen that renders differently for managers.

const MANAGER_ROLES = [
  "owner",
  "admin",
  "organizer",
  "chair",
  "treasurer",
];

function isManager(role) {
  return MANAGER_ROLES.includes(String(role || "").toLowerCase());
}

export function canManageAnnouncements(role) {
  return isManager(role);
}

export function canPinAnnouncement(role) {
  return isManager(role);
}

export function canDeleteAnnouncement(role) {
  return isManager(role);
}

export function canManageMeetings(role) {
  return isManager(role);
}

export function canManageMembers(role) {
  return isManager(role);
}

// Roles a manager can hand to another member from the Members page.
// This is intentionally a generic starter set, not a strict enum — your
// backend may define chama-specific roles (treasurer, secretary) and
// contribution-group-specific ones (organizer) differently. Adjust this
// list to match whatever your API actually accepts.
export const ASSIGNABLE_ROLES = [
  "member",
  "treasurer",
  "secretary",
  "chair",
  "organizer",
  "admin",
];