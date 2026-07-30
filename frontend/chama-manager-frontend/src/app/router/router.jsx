import {
  createBrowserRouter, Navigate
} from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";
import GuestRoute from "./GuestRoute";

import LoginPage from "@/modules/auth/pages/LoginPage";
import RegisterPage from "@/modules/auth/pages/RegisterPage";

import DashboardPage from "@/modules/dashboard/pages/DashboardPage";
import MembersPage from "@/modules/members/pages/MembersPage";
import FinancePage from "@/modules/finance/pages/FinancePage";
import LoansPage from "@/modules/loans/pages/LoansPage";
import ReportsPage from "@/modules/reports/pages/ReportsPage";
import SettingsPage from "@/modules/settings/pages/SettingsPage";
import WorkspacesPage from "@/modules/workspaces/pages/WorkspacesPage";

const router = createBrowserRouter([
  {
    element: <GuestRoute />,

    children: [
      {
        path: "/login",
        element: <LoginPage />,
      },
      {
        path: "/register",
        element: <RegisterPage />,
      },
    ],
  },

  {
    element: <ProtectedRoute />,

    children: [
      {
        path: "/dashboard",
        element: <DashboardPage />,
      },
      {
        path: "/workspaces",
        element: <WorkspacesPage />,
      },
      {
        path: "/members",
        element: <MembersPage />,
      },
      {
        path: "/finance",
        element: <FinancePage />,
      },
      {
        path: "/loans",
        element: <LoansPage />,
      },
      {
        path: "/reports",
        element: <ReportsPage />,
      },
      {
        path: "/settings",
        element: <SettingsPage />,
      },
    ],
  },

  {
    path: "*",
    element: <Navigate to="/dashboard" replace />,
  },
]);

export default router;