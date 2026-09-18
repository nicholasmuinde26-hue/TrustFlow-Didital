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
  Globe,
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

import { canViewAdministration, canViewFullBooks, canViewLeadershipDesk } from "../permissions/Permissions";

// Nav items inside "Books & Reports" that expose the chama's raw
// double-entry books rather than a member-facing statement - gated by
// canViewFullBooks() in filterByRole() below. Transactions is
// deliberately NOT here: the backend now scopes it down to "your own"
// transactions for a plain member instead of blocking it outright (see
// finance.controller.js#getFinanceTransactions), so it stays visible to
// everyone. Balance Sheet / Income Statement / Cash Flow / Reports also
// stay visible to everyone - they're the member-facing statements
// ReportsPage.jsx already marks as not management-only.
const CHAMA_BOOKS_OFFICIAL_ONLY_TITLES = ["General Ledger", "Chama Wallet", "Trial Balance", "Bank Accounts"];

export function getWorkspaceNavigation(workspaceId, type, role, category) {
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
      { title: "Merchant Marketplace", icon: Store, to: `${base}/business/marketplace` }
    );
  } else if (isRestaurant) {
    operationsItems.push(
      { title: "Menu Items", icon: Package, to: `${base}/business/inventory` },
      { title: "Point of Sale (POS)", icon: ShoppingBag, to: `${base}/business/pos` },
      { title: "Orders & Sales", icon: ShoppingCart, to: `${base}/business/sales` },
      { title: "Kitchen & Food Prep", icon: ClipboardList, to: `${base}/business/kitchen` },
      { title: "Expenses", icon: BadgeDollarSign, to: `${base}/business/expenses` },
      { title: "Merchant Marketplace", icon: Store, to: `${base}/business/marketplace` }
    );
  } else if (isService) {
    operationsItems.push(
      { title: "Services", icon: Package, to: `${base}/business/inventory` },
      { title: "Appointments & Jobs", icon: ClipboardList, to: `${base}/business/sales` },
      { title: "Invoices & Billing", icon: ShoppingCart, to: `${base}/business/sales` },
      { title: "Expenses", icon: BadgeDollarSign, to: `${base}/business/expenses` },
      { title: "Merchant Marketplace", icon: Store, to: `${base}/business/marketplace` }
    );
  } else {
    // Retail & Other
    operationsItems.push(
      { title: "Point of Sale (POS)", icon: ShoppingBag, to: `${base}/business/pos` },
      { title: "Sales & Invoicing", icon: ShoppingCart, to: `${base}/business/sales` },
      { title: "Inventory & Stock", icon: Package, to: `${base}/business/inventory` },
      { title: "Expenses", icon: BadgeDollarSign, to: `${base}/business/expenses` },
      { title: "Merchant Marketplace", icon: Store, to: `${base}/business/marketplace` }
    );
  }

  // =====================================================
  // 1. BUSINESS WORKSPACE NAVIGATION
  // =====================================================
  const businessNavigation = [
    {
      items: [
        {
          title: "Overview",
          icon: LayoutDashboard,
          to: `${base}/business`,
        },
      ],
    },

    {
      title: "Business Operations",
      items: operationsItems,
    },

    {
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
  // 3. CHAMA WORKSPACE NAVIGATION
  // =====================================================
  const chamaNavigation = [
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
          title: "My Chama",
          icon: Wallet,
          to: `${base}/my-chama`,
        },
      ],
    },

   
    {
      title: "Chama Operations",
      items: [
        // The Command Center used to sit right here next to the
        // Leadership Desk — two links, same permission check, doing
        // overlapping things. It's now a set of tabs inside the desk,
        // so there is exactly one way in.
        {
          title: "Leadership Desk",
          icon: Users2,
          to: `${base}/leadership`,
        },
        {
          title: "Loans",
          icon: HandCoins,
          to: `${base}/loans`,
        },
        {
          title: "Meeting Records",
          icon: CalendarClock,
          to: `${base}/meetings`,
        },
        {
          title: "Polls",
          icon: Vote,
          to: `${base}/polls`,
        },
        {
          title: "Announcements",
          icon: Megaphone,
          to: `${base}/announcements`,
        },
        {
          title: "Messages",
          icon: MessageSquare,
          to: `${base}/chat`,
        },
      ],
    },

    {
      title: "Money & Contributions",
      items: [
        {
          title: "Dashboard",
          icon: Wallet,
          to: `${base}/finance`,
        },
        {
          // Was pointing at `${base}/contributions`, which is actually
          // the Contribution-Group module's route reused by path
          // coincidence — wrong page for a Chama workspace. The real
          // Chama contributions view lives under /finance.
          title: "Contributions",
          icon: Coins,
          to: `${base}/finance/contributions`,
        },
        {
          title: "Record Contribution",
          icon: PlusCircle,
          to: `${base}/finance/record-contribution`,
        },
        {
          title: "Savings",
          icon: PiggyBank,
          to: `${base}/finance/savings`,
        },
         {
          title: "Merry-Go-Round (MGR)",
          icon: ArrowLeftRight,
          to: `${base}/mgr`,
        },
        {
          title: "Chama Contributions",
          icon: HeartHandshake,
          to: `${base}/chama-contributions`,
        },
        {
          title: "Payouts",
          icon: ArrowLeftRight,
          to: `${base}/finance/payouts`,
        },
        {
          title: "Savings Share-Out",
          icon: PiggyBank,
          to: `${base}/finance/savings-shareout`,
        },
      ],
    },

    {
      title: "Books",
      items: [
        {
          title: "Transactions",
          icon: Receipt,
          to: `${base}/finance/transactions`,
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
        {
          title: "Reports",
          icon: FileBarChart2,
          to: `${base}/reports`,
        },
        {
          title: "Trust Timeline",
          icon: ShieldCheck,
          to: `${base}/trust-timeline`,
        },
        {
          title: "Trust Score",
          icon: ShieldQuestion,
          to: `${base}/trust-score`,
        },
        {
          title: "Disputes",
          icon: Gavel,
          to: `${base}/disputes`,
        },
        {
          title: "Official Accountability",
          icon: Star,
          to: `${base}/officials`,
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
    const chamaBacked = type === "chama" || type === "burial-chama";

    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (item.title === "Leadership Desk") {
            return canViewLeadershipDesk(role, type);
          }
          if (section.title === "Administration") {
            if (chamaBacked) return false;
            return canViewAdministration(role, type);
          }
          if (
            section.title === "Books & Reports" &&
            CHAMA_BOOKS_OFFICIAL_ONLY_TITLES.includes(item.title)
          ) {
            return canViewFullBooks(role, type);
          }
          return true;
        }),
      }))
      .filter((section) => section.items.length > 0);
  }

  // =====================================================
  // 4. BURIAL CHAMA NAVIGATION
  //
  // Deliberately NOT a copy of the standard chama nav. A burial /
  // welfare chama's core job is bereavement cover, not rotating
  // savings — so MGR and "Savings Share-Out" (which imply the fund
  // gets fully divided out among members, table-banking style) are
  // dropped. In their place: an "Income & Fundraising" section for
  // the things burial groups actually do to grow the welfare fund
  // in a Kenyan context — hiring out tents/chairs/cooking gear for
  // funerals and events, lending surplus at interest, and running
  // harambees for cases that exceed the standard payout.
  // =====================================================
  const burialChamaNavigation = [
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
          title: "My Chama",
          icon: Wallet,
          to: `${base}/my-chama`,
        },
      ],
    },

    {
      title: "Burial Chama",
      items: [
        {
          title: "Setup Wizard",
          icon: ShieldCheck,
          to: `${base}/burial-chama-setup`,
        },
        {
          title: "Beneficiaries",
          icon: UserPlus,
          to: `${base}/beneficiaries`,
        },
        {
          title: "Burial Cases",
          icon: HeartPulse,
          to: `${base}/burial-cases`,
        },
        {
          title: "Member Statement",
          icon: FileText,
          to: `${base}/member-statement`,
        },
      ],
    },

    {
      title: "Welfare & Contributions",
      items: [
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
          title: "Welfare Fund",
          icon: PiggyBank,
          to: `${base}/finance/savings`,
        },
        {
          title: "Benevolent Payouts",
          icon: ArrowLeftRight,
          to: `${base}/finance/payouts`,
        },
      ],
    },

    {
      title: "Income & Fundraising",
      items: [
        {
          title: "Emergency Loans",
          icon: HandCoins,
          to: `${base}/loans`,
        },
        {
          title: "Equipment & Tent Hire",
          icon: Tent,
          to: `${base}/equipment-hire`,
        },
        {
          title: "Harambee & Fundraising",
          icon: Megaphone,
          to: `${base}/fundraising`,
        },
      ],
    },

    {
      title: "Meetings & Notices",
      items: [
        {
          title: "Meeting Records",
          icon: Video,
          to: `${base}/meetings`,
        },
        {
          title: "Polls",
          icon: Vote,
          to: `${base}/polls`,
        },
        {
          title: "Announcements",
          icon: MessageSquare,
          to: `${base}/announcements`,
        },
      ],
    },

    {
      title: "Books & Reports",
      items: [
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
        {
          title: "Chama Wallet",
          icon: Landmark,
          to: `${base}/finance/accounts`,
        },
        {
          title: "Bank Accounts",
          icon: Building2,
          to: `${base}/finance/bank-accounts`,
        },
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
        {
          title: "Reports",
          icon: FileBarChart2,
          to: `${base}/reports`,
        },
      ],
    },

    // Titled "Chama Operations", not "Administration": the filter below
    // drops the Administration section outright for Chama-backed
    // workspaces (their settings are a tab in the desk), and this item
    // would be swept away with it.
    {
      title: "Chama Operations",
      items: [
        {
          title: "Leadership Desk",
          icon: Users2,
          to: `${base}/leadership`,
        },
      ],
    },
  ];

  // =====================================================
  // WORKSPACE ROUTER MATCHING
  // =====================================================
  switch (normalizedType) {
    case "business":
      return businessNavigation;

    case "contribution":
    case "contributiongroup":
      return filterByRole(contributionNavigation);

    case "burialchama":
      return filterByRole(burialChamaNavigation);

    case "chama":
    default:
      return filterByRole(chamaNavigation);
  }
}