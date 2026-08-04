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
} from "lucide-react";

// Returns the sidebar sections for a given workspace, based on its type.
// "chama"              -> full finance operating system
// "contribution-group" -> lighter, event-centric shell
export function getWorkspaceNavigation(workspaceId, type) {
  const base = `/workspace/${workspaceId}`;

  if (type === "contribution-group") {
    return [
      {
        title: "Workspace",
        items: [
          { title: "Overview", icon: LayoutDashboard, to: base },
          { title: "Chat", icon: MessageSquare, to: `${base}/chat` },
          { title: "Announcements", icon: Megaphone, to: `${base}/announcements` },
          { title: "Contributions", icon: Coins, to: `${base}/contributions` },
          { title: "Members", icon: Users, to: `${base}/members` },
          { title: "Meetings", icon: Video, to: `${base}/meetings` },
          { title: "Schedule", icon: CalendarClock, to: `${base}/schedule` },
          { title: "Activity", icon: Activity, to: `${base}/activity` },
        ],
      },
      {
        title: "Administration",
        items: [
          { title: "Settings", icon: Settings, to: `${base}/settings` },
        ],
      },
    ];
  }

  // Default: chama
  return [
    {
      title: "Workspace",
      items: [
        { title: "Overview", icon: LayoutDashboard, to: base },
        { title: "Chat", icon: MessageSquare, to: `${base}/chat` },
        { title: "Announcements", icon: Megaphone, to: `${base}/announcements` },
        { title: "Members", icon: Users, to: `${base}/members` },
        { title: "Finance", icon: Wallet, to: `${base}/finance` },
        { title: "Loans", icon: HandCoins, to: `${base}/loans` },
        { title: "Meetings", icon: Video, to: `${base}/meetings` },
        { title: "Reports", icon: FileBarChart2, to: `${base}/reports` },
      ],
    },
    {
      title: "Administration",
      items: [
        { title: "Settings", icon: Settings, to: `${base}/settings` },
      ],
    },
  ];
}