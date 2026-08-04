import { createBrowserRouter, Navigate } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";
import GuestRoute from "./GuestRoute";

import PlatformLayout from "@/layouts/PlatformLayout";
import WorkspaceLayout from "@/layouts/WorkspaceLayout";

import LandingPage from "@/modules/landing/pages/LandingPage";

import LoginPage from "@/modules/auth/pages/LoginPage";
import RegisterPage from "@/modules/auth/pages/RegisterPage";

import HomePage from "@/modules/home/pages/HomePage";
import CreateChamaPage from "@/modules/home/pages/CreateChamaPage";
import JoinChamaPage from "@/modules/home/pages/JoinChamaPage";
import CreateContributionGroupPage from "@/modules/home/pages/CreateContributionGroupPage";
import JoinContributionGroupPage from "@/modules/home/pages/JoinContributionGroupPage";

import WorkspaceOverviewPage from "@/modules/workspaces/pages/WorkspaceOverviewPage";
import WorkspaceSettingsPage from "@/modules/workspaces/pages/WorkspaceSettingsPage";
import MembersPage from "@/modules/members/pages/MembersPage";

import FinancePage from "@/modules/chama/pages/FinancePage";
import LoansPage from "@/modules/chama/pages/LoansPage";
import ReportsPage from "@/modules/chama/pages/ReportsPage";

import ContributionsPage from "@/modules/contribution-group/pages/ContributionsPage";
import SchedulePage from "@/modules/contribution-group/pages/SchedulePage";
import ActivityPage from "@/modules/contribution-group/pages/ActivityPage";

import AnnouncementsPage from "@/modules/announcements/pages/AnnouncementsPage";
import ChatPage from "@/modules/chat/pages/ChatPage";
import MeetingsPage from "@/modules/meetings/pages/MeetingsPage";

const router = createBrowserRouter([
  // Public
  {
    path: "/",
    element: <LandingPage />,
  },

  // Guest-only
  {
    element: <GuestRoute />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
    ],
  },

  // Authenticated
  {
    element: <ProtectedRoute />,
    children: [
      // User Platform layer — no workspace selected yet
      {
        element: <PlatformLayout />,
        children: [
          { path: "/home", element: <HomePage /> },
          { path: "/chamas/new", element: <CreateChamaPage /> },
          { path: "/chamas/join", element: <JoinChamaPage /> },
          { path: "/contribution-groups/new", element: <CreateContributionGroupPage /> },
          { path: "/contribution-groups/join", element: <JoinContributionGroupPage /> },
        ],
      },

      // Workspace layer — everything below is scoped to one workspace
      {
        path: "/workspace/:workspaceId",
        element: <WorkspaceLayout />,
        children: [
          { index: true, element: <WorkspaceOverviewPage /> },
          { path: "members", element: <MembersPage /> },
          { path: "settings", element: <WorkspaceSettingsPage /> },
          { path: "announcements", element: <AnnouncementsPage /> },
          { path: "chat", element: <ChatPage /> },
          { path: "meetings", element: <MeetingsPage /> },

          // Chama-only
          { path: "finance", element: <FinancePage /> },
          { path: "loans", element: <LoansPage /> },
          { path: "reports", element: <ReportsPage /> },

          // Contribution-group-only
          { path: "contributions", element: <ContributionsPage /> },
          { path: "schedule", element: <SchedulePage /> },
          { path: "activity", element: <ActivityPage /> },
        ],
      },
    ],
  },

  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);

export default router;