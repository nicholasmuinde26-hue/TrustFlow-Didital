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
        path: "/members",
        element: <MembersPage />,
      },
      {
        path: "/finance",
        element: <FinancePage />,
      },
    ],
  },

  {
    path: "*",
    element: <Navigate to="/dashboard" replace />,
  },
]);

export default router;