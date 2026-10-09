import {
  LayoutDashboard,
  Users,
  Wallet,
  HandCoins,
  FileBarChart2,
  Settings,
  Coins,
  CalendarClock,
  Activity,
  Video,
  Receipt,
  BookOpen,
  Landmark,
  PlusCircle,
  PiggyBank,
  ArrowLeftRight,
  Scale,
  BarChart3,
  TrendingUp,
  LineChart,
  HeartHandshake,

  // Business Specific Icons
  ShoppingCart,
  Package,
  Truck,
  CreditCard,
  Building2,
  BadgeDollarSign,
  Store,
  ShoppingBag,
  Home,
  ClipboardList,

  // Burial Chama Specific Icons
  HeartPulse,
  UserPlus,
  FileText,
  Smartphone,
  MessageSquare,
  ShieldCheck,
  ShieldQuestion,
  Gavel,
  Star,
  Users2,
  Tent,
  Megaphone,
  Vote,
} from "lucide-react";

import { canViewAdministration, canViewLeadershipDesk } from "../permissions/Permissions";
import { buildChamaNavigation } from "./chamaNavigation";

// The Leadership Desk lives only as the pinned "Desk" button in the sidebar
// rail (and the Ctrl+K palette) - not in any nav section, so it does not
// show in the section tab bar or the "All tools" drawer. Role-gated here
// exactly as it used to be inside filterByRole(); returns null when the
// current member may not open it.
export function getLeadershipDeskItem(workspaceId, type, role) {
  if (!workspaceId || !canViewLeadershipDesk(role, type)) return null;
  return {
    title: "Leadership Desk",
    icon: Users2,
    to: `/workspace/${workspaceId}/leadership`,
  };
}

// `enabledModules` is workspace.modules from the backend (chamas only). Items
// whose route belongs to a switched-off module are dropped, and sections left
// empty disappear - so a chama without loans has no Loans link anywhere.
// null/undefined means "no module information": nothing is hidden.
export function getWorkspaceNavigation(workspaceId, type, role, category, workspaceSettings = null, enabledModules = null) {
  const base = `/workspace/${workspaceId}`;
  const normalizedType = type?.toLowerCase().replace(/[-_]/g, "");
  // Category flags
  const isRental = category === "rental";
  const isRetail = category === "retail";
  const isRestaurant = category === "restaurant";
  const isService = category === "service";

  // Specialized Business Operations per Category
  let operationsItems = [
    { title: "Dashboard", icon: Store, to: `${base}/business` },
  ];

  if (isRental) {
    operationsItems.push(
      { title: "Rooms & Plots", icon: Home, to: `${base}/business/rental-listings` },
      { title: "Tenant Inquiries", icon: ClipboardList, to: `${base}/business/rental-inquiries` },
      { title: "Rent Collections", icon: ShoppingCart, to: `${base}/business/sales` },
      { title: "Maintenance & Expenses", icon: BadgeDollarSign, to: `${base}/business/expenses` },
      { title: "Marketplace", icon: Store, to: `${base}/business/marketplace` }
    );
  } else if (isRestaurant) {
    operationsItems.push(
      { title: "Menu Items", icon: Package, to: `${base}/business/inventory` },
      { title: "Point of Sale (POS)", icon: ShoppingBag, to: `${base}/business/pos` },
      { title: "Orders & Sales", icon: ShoppingCart, to: `${base}/business/sales` },
      { title: "Kitchen & Food Prep", icon: ClipboardList, to: `${base}/business/kitchen` },
      { title: "Expenses", icon: BadgeDollarSign, to: `${base}/business/expenses` },
      { title: "Marketplace", icon: Store, to: `${base}/business/marketplace` }
    );
  } else if (isService) {
    operationsItems.push(
      { title: "Services", icon: Package, to: `${base}/business/inventory` },
      { title: "Point of Sale (POS)", icon: ShoppingBag, to: `${base}/business/pos` },
      { title: "Appointments & Jobs", icon: ClipboardList, to: `${base}/business/sales` },
      { title: "Invoices & Billing", icon: ShoppingCart, to: `${base}/business/sales` },
      { title: "Expenses", icon: BadgeDollarSign, to: `${base}/business/expenses` },
      { title: "Marketplace", icon: Store, to: `${base}/business/marketplace` }
    );
  } else {
    // Retail & Other
    operationsItems.push(
      { title: "Point of Sale (POS)", icon: ShoppingBag, to: `${base}/business/pos` },
      { title: "Sales & Invoicing", icon: ShoppingCart, to: `${base}/business/sales` },
      { title: "Inventory & Stock", icon: Package, to: `${base}/business/inventory` },
      { title: "Expenses", icon: BadgeDollarSign, to: `${base}/business/expenses` },
      { title: "Marketplace", icon: Store, to: `${base}/business/marketplace` }
    );
  }

  // =====================================================
  // 1. BUSINESS WORKSPACE NAVIGATION
  // =====================================================
  const businessNavigation = [
    {
      sectionKey: "overview",
      items: [
        {
          title: "Overview",
          icon: LayoutDashboard,
          to: `${base}/business`,
        },
      ],
    },

    {
      sectionKey: "operations",
      title: "Business Operations",
      items: operationsItems,
    },

    {
      sectionKey: "people",
      title: "People & Partners",
      items: [
        {
          title: isRental ? "Tenants & Customers" : isService ? "Clients & Customers" : "Customers",
          icon: Users,
          to: `${base}/business/customers`,
        },
        // Suppliers are a goods/vendor-payout concept (restock, wholesale,
        // ingredient vendors). Doesn't apply to a rental portfolio
        // (maintenance vendors are tracked as expense payees instead) or a
        // service provider (no stock to restock — see CATEGORIES in
        // CreateBusinessPage.jsx: "Services, Appointments, Customer Jobs,
        // Invoices & Expenses", no supplier concept).
        ...(isRental || isService
          ? []
          : [
              {
                title: "Suppliers",
                icon: Truck,
                to: `${base}/business/suppliers`,
              },
            ]),
      ],
    },

    {
      sectionKey: "finance",
      title: "Treasury & Finance",
      items: [
        {
          title: "Cash & Accounts",
          icon: CreditCard,
          to: `${base}/business/accounts`,
        },
        {
          title: "Finance Dashboard",
          icon: Wallet,
          to: `${base}/finance`,
        },
        {
          title: "Transactions",
          icon: Receipt,
          to: `${base}/finance/transactions`,
        },
        {
          title: "General Ledger",
          icon: BookOpen,
          to: `${base}/finance/ledger`,
        },
      ],
    },

    {
      sectionKey: "statements",
      title: "Financial Statements",
      items: [
        {
          title: "Trial Balance",
          icon: Scale,
          to: `${base}/finance/trial-balance`,
        },
        {
          title: "Balance Sheet",
          icon: BarChart3,
          to: `${base}/finance/balance-sheet`,
        },
        {
          title: "Income Statement",
          icon: TrendingUp,
          to: `${base}/finance/income-statement`,
        },
        {
          title: "Cash Flow",
          icon: LineChart,
          to: `${base}/finance/cash-flow`,
        },
      ],
    },

    {
      sectionKey: "reports",
      title: "Reports & Analytics",
      items: [
        {
          title: "Reports",
          icon: FileBarChart2,
          to: `${base}/business/reports`,
        },
      ],
    },

    {
      sectionKey: "settings",
      title: "Administration",
      items: [
        {
          title: "Business Settings",
          icon: Building2,
          to: `${base}/business/settings`,
        },
      ],
    },
  ];

  // =====================================================
  // 2. CONTRIBUTION GROUP NAVIGATION
  // =====================================================
  const contributionNavigation = [
    {
      items: [
        {
          title: "Overview",
          icon: LayoutDashboard,
          to: base,
        },
        {
          title: "Members",
          icon: Users,
          to: `${base}/members`,
        },
        {
          title: "Expenses",
          icon: Receipt,
          to: `${base}/updates`,
        },
        {
          title: "Contributions",
          icon: Coins,
          to: `${base}/contributions`,
        },
        {
          title: "Record Contribution",
          icon: PlusCircle,
          to: `${base}/finance/record-contribution`,
        },
        {
          title: "Meetings",
          icon: Video,
          to: `${base}/meetings`,
        },
        {
          title: "Polls",
          icon: Vote,
          to: `${base}/polls`,
        },
        {
          title: "Schedule",
          icon: CalendarClock,
          to: `${base}/schedule`,
        },
        {
          title: "Activity",
          icon: Activity,
          to: `${base}/activity`,
        },
      ],
    },

    {
      title: "Administration",
      items: [
        {
          title: "Settings",
          icon: Settings,
          to: `${base}/settings`,
        },
      ],
    },
  ];

  // =====================================================
  // ROLE-BASED FILTERING
  //
  // The Leadership Desk is a management-only area — plain members
  // shouldn't see a link to it at all, not just be blocked once they
  // get there. Sections that end up with no items after filtering are
  // dropped entirely.
  //
  // "Administration" is now only rendered for workspace types that
  // still have a standalone settings page (Contribution Groups,
  // Business). For a Chama it is the desk's Governance Settings tab,
  // and showing both would rebuild the collision this merge removed.
  // =====================================================
  function filterByRole(sections) {
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (item.title === "Record Contribution") return true;
          if (section.title === "Administration") {
            return canViewAdministration(role, type);
          }
          return true;
        }),
      }))
      .filter((section) => section.items.length > 0);
  }

  // =====================================================
  // WORKSPACE ROUTER MATCHING
  // =====================================================
  switch (normalizedType) {
    case "business": {
      const configuredSections = workspaceSettings?.enabled_sections;
      const visibleSections = Array.isArray(configuredSections)
        ? businessNavigation.filter((section) => configuredSections.includes(section.sectionKey))
        : businessNavigation;
      return filterByRole(visibleSections);
    }

    case "contribution":
    case "contributiongroup":
      return filterByRole(contributionNavigation);

    case "burialchama":
      return buildChamaNavigation({ workspaceId, type, role, shell: "burial", enabledModules });

    case "chama":
    default:
      return buildChamaNavigation({ workspaceId, type, role, shell: "chama", enabledModules });
  }
}

// Resolve the single navigation section that owns a route. Longest-path wins,
// so /finance/transactions belongs to Books instead of the broader /finance
// dashboard route. Use this for active navigation and breadcrumbs alike.
export function findWorkspaceNavigationMatch(sections = [], pathname = "") {
  const currentPath = String(pathname).replace(/\/$/, "") || "/";
  let best = null;
  sections.forEach((section) => {
    (section.items || []).forEach((item) => {
      const to = String(item.to || "").replace(/\/$/, "");
      if (!to || !(currentPath === to || currentPath.startsWith(`${to}/`))) return;
      if (!best || to.length > best.item.to.length) best = { section, item };
    });
  });
  return best;
}
