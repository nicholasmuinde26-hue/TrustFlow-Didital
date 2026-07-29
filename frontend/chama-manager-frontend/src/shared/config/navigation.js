import {
  LayoutDashboard,
  BriefcaseBusiness,
  Users,
  Wallet,
  HandCoins,
  FileBarChart2,
  Settings,
} from "lucide-react";

const navigation = [
  {
    title: "General",
    items: [
      {
        title: "Dashboard",
        icon: LayoutDashboard,
        to: "/dashboard",
      },
    ],
  },

  {
    title: "Workspace",
    items: [
      {
        title: "Workspaces",
        icon: BriefcaseBusiness,
        to: "/workspaces",
      },
      {
        title: "Members",
        icon: Users,
        to: "/members",
      },
      {
        title: "Finance",
        icon: Wallet,
        to: "/finance",
      },
      {
        title: "Loans",
        icon: HandCoins,
        to: "/loans",
      },
    ],
  },

  {
    title: "Administration",
    items: [
      {
        title: "Reports",
        icon: FileBarChart2,
        to: "/reports",
      },
      {
        title: "Settings",
        icon: Settings,
        to: "/settings",
      },
    ],
  },
];

export default navigation;