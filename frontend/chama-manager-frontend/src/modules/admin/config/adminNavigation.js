import {
  LayoutDashboard,
  ShieldAlert,
  LifeBuoy,
  MessageSquare,
  Inbox,
  FolderKanban,
  Users,
  PlusCircle,
  Store,
  Banknote,
  UserCheck,
  History,
} from "lucide-react";

/**
 * Admin navigation — single source of truth for the sidebar, the mobile
 * drawer, the ⌘K palette and the topbar page title.
 *
 * Items are grouped by *kind of work* (not by feature) and filtered by the
 * permissions the server assigned to this admin. The server still enforces
 * every permission; this only decides what is worth showing.
 */

export const WORKSPACE_NAMES = {
  finance: "Finance workspace",
  security: "Security workspace",
  support: "Support workspace",
  operations: "Operations workspace",
  compliance: "Compliance workspace",
  onboarding: "Onboarding workspace",
  marketplace: "Marketplace workspace",
  super_admin: "Platform owner",
};

export const HOME_LABELS = {
  finance: "Treasury",
  security: "Risk overview",
  support: "Ticket queue",
  operations: "Overview",
  compliance: "Control review",
  onboarding: "Onboarding queue",
  marketplace: "Moderation queue",
  super_admin: "Overview",
};

export const PERMISSION_LABELS = {
  users: "People",
  chamas: "Chamas",
  businesses: "Businesses",
  contributionGroups: "Groups",
  finance: "Finance",
  auditLogs: "Audit logs",
  security: "Security",
  support: "Support",
  onboarding: "Onboarding",
  marketplace: "Marketplace",
  approveListings: "Listings",
};

export function buildAdminNavigation({ category, can, isSuperAdmin, counts = {} }) {
  const groups = [
    {
      id: "command",
      label: "Command",
      items: [
        {
          to: "/admin",
          label: HOME_LABELS[category] || "Overview",
          icon: LayoutDashboard,
          exact: true,
          keywords: "home dashboard overview summary",
        },
        can("security") && {
          to: "/admin/security",
          label: "Security Center",
          icon: ShieldAlert,
          keywords: "fraud risk threats auth signals",
        },
      ],
    },
    {
      id: "queues",
      label: "Work queues",
      items: [
        (isSuperAdmin || can("support") || can("finance")) && {
          to: "/admin/support",
          label: "Support Desk",
          icon: LifeBuoy,
          badge: counts.support,
          keywords: "billing payments cases tickets help",
        },
        can("support") && {
          to: "/admin/inquiries",
          label: "Inquiries & Reports",
          icon: MessageSquare,
          badge: counts.inquiries,
          keywords: "tickets reports messages",
        },
        can("onboarding") && {
          to: "/admin/requests",
          label: "Workspace Requests",
          icon: Inbox,
          badge: counts.requests,
          keywords: "approvals pending onboarding review",
        },
        can("onboarding") && {
          to: "/admin/chama-kyc",
          label: "Chama Verification",
          icon: UserCheck,
          keywords: "kyc verify group registration certificate",
        },
      ],
    },
    {
      id: "directory",
      label: "Directory",
      items: [
        (can("chamas") || can("businesses") || can("contributionGroups")) && {
          to: "/admin/directory",
          label: "All Workspaces",
          icon: FolderKanban,
          keywords: "chamas businesses groups entities",
        },
        can("users") && {
          to: "/admin/people",
          label: "People",
          icon: Users,
          keywords: "users members accounts",
        },
        can("onboarding") && {
          to: "/admin/create",
          label: "Create Entity",
          icon: PlusCircle,
          keywords: "new workspace chama business group",
        },
      ],
    },
    {
      id: "platform",
      label: "Platform",
      items: [
        (isSuperAdmin || can("marketplace") || can("approveListings")) && {
          to: "/admin/marketplace",
          label: "Marketplace Hubs",
          icon: Store,
          keywords: "listings moderation stores",
        },
        isSuperAdmin && {
          to: "/admin/revenue",
          label: "Revenue",
          icon: Banknote,
          keywords: "income billing earnings",
        },
        isSuperAdmin && {
          to: "/admin/sub-admins",
          label: "Sub-Admins",
          icon: UserCheck,
          keywords: "staff appointments permissions team",
        },
        (isSuperAdmin || can("auditLogs")) && {
          to: "/admin/activity",
          label: "Admin Activity",
          icon: History,
          keywords: "audit log evidence trail",
        },
      ],
    },
  ];

  return groups
    .map((group) => ({ ...group, items: group.items.filter(Boolean) }))
    .filter((group) => group.items.length > 0);
}

export const flattenNavigation = (groups) =>
  groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })));

export function isNavActive(item, pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return item.exact ? path === item.to : path === item.to || path.startsWith(`${item.to}/`);
}

export function findActiveItem(items, pathname) {
  return items
    .filter((item) => isNavActive(item, pathname))
    .sort((a, b) => b.to.length - a.to.length)[0];
}
