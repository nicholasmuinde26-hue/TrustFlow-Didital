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
  Megaphone,
  MessageSquare,
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

  // Business Specific Icons
  ShoppingCart,
  Package,
  Truck,
  CreditCard,
  Building2,
  BadgeDollarSign,
  Store,
} from "lucide-react";

export function getWorkspaceNavigation(workspaceId, type) {
  const base = `/workspace/${workspaceId}`;
  const normalizedType = type?.toLowerCase().replace(/[-_]/g, "");

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
      items: [
        {
          title: "Dashboard",
          icon: Store,
          to: `${base}/business`,
        },
        {
          title: "Sales & Invoicing",
          icon: ShoppingCart,
          to: `${base}/business/sales`,
        },
        {
          title: "Expenses",
          icon: BadgeDollarSign,
          to: `${base}/business/expenses`,
        },
        {
          title: "Inventory & Stock",
          icon: Package,
          to: `${base}/business/inventory`,
        },
      ],
    },

    {
      title: "People & Partners",
      items: [
        {
          title: "Customers",
          icon: Users,
          to: `${base}/business/customers`,
        },
        {
          title: "Suppliers",
          icon: Truck,
          to: `${base}/business/suppliers`,
        },
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
          title: "Chat",
          icon: MessageSquare,
          to: `${base}/chat`,
        },
        {
          title: "Announcements",
          icon: Megaphone,
          to: `${base}/announcements`,
        },
        {
          title: "Contributions",
          icon: Coins,
          to: `${base}/contributions`,
        },
        {
          title: "Meetings",
          icon: Video,
          to: `${base}/meetings`,
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
        {
          title: "Command Center",
          icon: Settings,
          to: `${base}/command-center`,
        },
        {
          title: "Loans",
          icon: HandCoins,
          to: `${base}/loans`,
        },
        {
          title: "Meeting Records",
          icon: Video,
          to: `${base}/meetings`,
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
          title: "Contributions",
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
          title: "Payouts",
          icon: ArrowLeftRight,
          to: `${base}/finance/payouts`,
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
          title: "Chart of Accounts",
          icon: Landmark,
          to: `${base}/finance/accounts`,
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

    {
      title: "Community",
      items: [
       
        {
          title: "Chat",
          icon: MessageSquare,
          to: `${base}/chat`,
        },
        {
          title: "Announcements",
          icon: Megaphone,
          to: `${base}/announcements`,
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
  // WORKSPACE ROUTER MATCHING
  // =====================================================
  switch (normalizedType) {
    case "business":
      return businessNavigation;

    case "contribution":
    case "contributiongroup":
      return contributionNavigation;

    case "chama":
    default:
      return chamaNavigation;
  }
}
