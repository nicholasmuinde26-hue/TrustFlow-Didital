import { createBrowserRouter, Navigate } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";
import GuestRoute from "./GuestRoute";

import PlatformLayout from "@/layouts/PlatformLayout";
import WorkspaceLayout from "@/layouts/WorkspaceLayout";

// ======================================================
// Landing
// ======================================================

import LandingPage from "@/modules/landing/pages/LandingPage";

// ======================================================
// Authentication
// ======================================================

import LoginPage from "@/modules/auth/pages/LoginPage";
import RegisterPage from "@/modules/auth/pages/RegisterPage";

// ======================================================
// Home & Creation Routes
// ======================================================

import HomePage from "@/modules/home/pages/HomePage";
import CreateChamaPage from "@/modules/home/pages/CreateChamaPage";
import JoinChamaPage from "@/modules/home/pages/JoinChamaPage";
import CreateContributionGroupPage from "@/modules/home/pages/CreateContributionGroupPage";
import CreateBusinessPage from "@/modules/home/pages/CreateBusinessPage";

// ======================================================
// Invitations
// ======================================================

import InvitationsPage from "@/modules/invitations/pages/InvitationsPage";

// ======================================================
// Personal Account
// ======================================================

import AccountSettingsPage from "@/modules/account/pages/AccountSettingsPage";

// ======================================================
// Workspace Core
// ======================================================

import WorkspaceOverviewPage from "@/modules/workspaces/pages/WorkspaceOverviewPage";
import WorkspaceSettingsPage from "@/modules/workspaces/pages/WorkspaceSettingsPage";
import WorkspacesPage from "@/modules/workspaces/pages/WorkspacesPage";
import RequireWorkspaceRole from "@/shared/components/routing/RequireWorkspaceRole";
import { canViewCommandCenter, canViewAdministration } from "@/modules/workspaces/permissions/Permissions";

// ======================================================
// Business Module
// ======================================================

import BusinessDashboard from "@/modules/business/pages/BusinessDashboard";
import SalesPage from "@/modules/business/pages/SalesPage";
import ExpensesPage from "@/modules/business/pages/ExpensesPage";
import AccountsPage from "@/modules/business/pages/AccountsPage";
import CustomersPage from "@/modules/business/pages/CustomersPage";
import SuppliersPage from "@/modules/business/pages/SuppliersPage";
import InventoryPage from "@/modules/business/pages/InventoryPage";
import RentalListingsPage from "@/modules/business/pages/RentalListingsPage";
import RentalInquiriesPage from "@/modules/business/pages/RentalInquiriesPage";
import BusinessReportsPage from "@/modules/business/pages/ReportsPage";
import BusinessSettingsPage from "@/modules/business/pages/BusinessSettingsPage";
import PosPage from "@/modules/business/pages/PosPage";
import KitchenPage from "@/modules/business/pages/KitchenPage";
import StorefrontPage from "@/modules/business/pages/StorefrontPage";

// ======================================================
// Public Storefront (buyer-facing, no auth)
// ======================================================

import PublicStorefrontPage from "@/modules/storefront/pages/PublicStorefrontPage";
import TrackOrderPage from "@/modules/storefront/pages/TrackOrderPage";
import PublicCausePreviewPage from "@/modules/contribution-group/pages/PublicCausePreviewPage";

// ======================================================
// Members
// ======================================================

import MembersPage from "@/modules/members/pages/MembersPage";

// ======================================================
// Communication
// ======================================================

import AnnouncementsPage from "@/modules/announcements/pages/AnnouncementsPage";
import ChatPage from "@/modules/chat/pages/ChatPage";
import MeetingsPage from "@/modules/meetings/pages/MeetingsPage";
import PollsPage from "@/modules/polls/pages/PollsPage";

// ======================================================
// Chama Module
// ======================================================

import LoansPage from "@/modules/loans/pages/LoansPage";
import ReportsPage from "@/modules/chama/pages/ReportsPage";
import ChamaFinancePage from "@/modules/chama/pages/FinancePage";
import MerryGoRoundPage from "@/modules/chama/pages/MerryGoRoundPage";
import ChamaCommandCenterPage from "@/modules/chama/pages/ChamaCommandCenterPage";
import MemberDashboardPage from "@/modules/chama/pages/MemberDashboardPage";

// ======================================================
// Contribution Groups
// ======================================================

import ContributionsPage from "@/modules/contribution-group/pages/ContributionsPage";
import SchedulePage from "@/modules/contribution-group/pages/SchedulePage";
import ActivityPage from "@/modules/contribution-group/pages/ActivityPage";
import UpdatesPage from "@/modules/contribution-group/pages/UpdatesPage";

// ======================================================
// Finance Engine
// ======================================================

import FinanceDashboard from "@/modules/finance/pages/FinanceDashboard";
import RecordContributionPage from "@/modules/finance/pages/RecordContributionPage";
import TransactionsPage from "@/modules/finance/pages/TransactionsPage";
import LedgerPage from "@/modules/finance/pages/LedgerPage";
import FinanceAccountsPage from "@/modules/finance/pages/AccountsPage";
import SavingsPage from "@/modules/finance/pages/SavingsPage";
import TrialBalancePage from "@/modules/finance/pages/TrialBalancePage";
import BalanceSheetPage from "@/modules/finance/pages/BalanceSheetPage";
import IncomeStatementPage from "@/modules/finance/pages/IncomeStatementPage";
import CashFlowStatementPage from "@/modules/finance/pages/CashFlowStatementPage";
import PayoutsPage from "@/modules/finance/pages/PayoutsPage";
import CreatePayoutPage from "@/modules/finance/pages/CreatePayoutPage";
import FinanceOperationPage from "@/modules/finance/pages/FinanceOperationPage";

const router = createBrowserRouter([
  // ======================================================
  // PUBLIC
  // ======================================================

  {
    path: "/",
    element: <LandingPage />,
  },

  // Public Cause Preview link (e.g. /g/CG-X89K2P)
  {
    path: "/g/:joinCode",
    element: <PublicCausePreviewPage />,
  },

  // ======================================================
  // PUBLIC STOREFRONT (buyer-facing, no auth, no app shell)
  // ======================================================

  {
    path: "/store/:slug",
    element: <PublicStorefrontPage />,
  },
  {
    path: "/store/:slug/track",
    element: <TrackOrderPage />,
  },

  // Chama join-link landing page. Deliberately public (not wrapped in
  // ProtectedRoute or GuestRoute) — it must render for a visitor who
  // isn't logged in yet AND for one who already is; the page itself
  // branches on auth state via useAuth().
  {
    path: "/chamas/join",
    element: <JoinChamaPage />,
  },

  // ======================================================
  // GUEST
  // ======================================================

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

  // ======================================================
  // AUTHENTICATED
  // ======================================================

  {
    element: <ProtectedRoute />,
    children: [
      // ==================================================
      // PLATFORM LAYOUT (Global Shell)
      // ==================================================

      {
        element: <PlatformLayout />,
        children: [
          {
            path: "/home",
            element: <HomePage />,
          },
          {
            path: "/workspaces",
            element: <WorkspacesPage />,
          },
          {
            path: "/invitations",
            element: <InvitationsPage />,
          },
          {
            path: "/account/settings",
            element: <AccountSettingsPage />,
          },

          // Workspace Creation Pages
          {
            path: "/business/new",
            element: <CreateBusinessPage />,
          },
          {
            path: "/chamas/new",
            element: <CreateChamaPage />,
          },
          {
            path: "/chamas/join",
            element: <JoinChamaPage />,
          },
          {
            path: "/contribution-groups/new",
            element: <CreateContributionGroupPage />,
          },
        ],
      },

      // ==================================================
      // WORKSPACE LAYOUT (Scoped Workspace Shell)
      // ==================================================

      {
        path: "/workspace/:workspaceId",
        element: <WorkspaceLayout />,
        children: [
          // Dashboard Overview Root
          {
            index: true,
            element: <WorkspaceOverviewPage />,
          },

          // ----------------------------------------------
          // BUSINESS MODULE
          // ----------------------------------------------

          {
            path: "business",
            element: <BusinessDashboard />,
          },
          {
            path: "business/sales",
            element: <SalesPage />,
          },
          {
            path: "business/expenses",
            element: <ExpensesPage />,
          },
          {
            path: "business/inventory",
            element: <InventoryPage />,
          },
          {
            path: "business/rental-listings",
            element: <RentalListingsPage />,
          },
          {
            path: "business/rental-inquiries",
            element: <RentalInquiriesPage />,
          },
          {
            path: "business/pos",
            element: <PosPage />,
          },
          {
            path: "business/kitchen",
            element: <KitchenPage />,
          },
          {
            path: "business/storefront",
            element: <StorefrontPage />,
          },
          {
            path: "business/customers",
            element: <CustomersPage />,
          },
          {
            path: "business/suppliers",
            element: <SuppliersPage />,
          },
          {
            path: "business/accounts",
            element: <AccountsPage />,
          },
          {
            path: "business/reports",
            element: <BusinessReportsPage />,
          },
          {
            path: "business/settings",
            element: <BusinessSettingsPage />,
          },

          // ----------------------------------------------
          // CONTRIBUTION GROUPS
          // ----------------------------------------------

          {
            path: "contributions",
            element: <ContributionsPage />,
          },
          {
            path: "schedule",
            element: <SchedulePage />,
          },
          {
            path: "activity",
            element: <ActivityPage />,
          },
          {
            path: "updates",
            element: <UpdatesPage />,
          },

          // ----------------------------------------------
          // CHAMA OPERATIONS
          // ----------------------------------------------

          {
            path: "loans",
            element: <LoansPage />,
          },
          {
            path: "reports",
            element: <ReportsPage />,
          },
          {
            path: "chama-finance",
            element: <ChamaFinancePage />,
          },
          {
            path: "mgr",
            element: <MerryGoRoundPage />,
          },
          {
            path: "command-center",
            element: (
              <RequireWorkspaceRole check={canViewCommandCenter}>
                <ChamaCommandCenterPage />
              </RequireWorkspaceRole>
            ),
          },
          {
            path: "my-chama",
            element: <MemberDashboardPage />,
          },

          // ----------------------------------------------
          // FINANCE ENGINE
          // ----------------------------------------------

          {
            path: "finance",
            element: <FinanceDashboard />,
          },
          {
            path: "finance/overview",
            element: <FinanceDashboard />,
          },
          {
            path: "finance/record-contribution",
            element: <RecordContributionPage />,
          },
          // Backwards-compatible aliases
          {
            path: "finance/contributions",
            // Keep the legacy sidebar URL on the same route level. Using
            // "../record-contribution" here resolves to /workspace/:id/
            // record-contribution and falls through to the landing page.
            element: <RecordContributionPage />,
          },
          {
            path: "finance/contributions/new",
            element: <RecordContributionPage />,
          },
          {
            path: "finance/transactions",
            element: <TransactionsPage />,
          },
          {
            path: "finance/ledger",
            element: <LedgerPage />,
          },
          {
            path: "finance/accounts",
            element: <FinanceAccountsPage />,
          },
          {
            path: "finance/savings",
            element: <SavingsPage />,
          },
          {
            path: "finance/trial-balance",
            element: <TrialBalancePage />,
          },
          {
            path: "finance/balance-sheet",
            element: <BalanceSheetPage />,
          },
          {
            path: "finance/income-statement",
            element: <IncomeStatementPage />,
          },
          {
            path: "finance/cash-flow",
            element: <CashFlowStatementPage />,
          },
          {
            path: "finance/payouts",
            element: <PayoutsPage />,
          },
          {
            path: "finance/payouts/new",
            element: <CreatePayoutPage />,
          },
          {
            path: "finance/deposits/new",
            element: <FinanceOperationPage operation="deposit" />,
          },
          {
            path: "finance/withdrawals/new",
            element: <FinanceOperationPage operation="withdrawal" />,
          },
          {
            path: "finance/transfers/new",
            element: <FinanceOperationPage operation="transfer" />,
          },

          // ----------------------------------------------
          // COLLABORATION & COMMUNICATION
          // ----------------------------------------------

          {
            path: "members",
            element: <MembersPage />,
          },
          {
            path: "chat",
            element: <ChatPage />,
          },
          {
            path: "announcements",
            element: <AnnouncementsPage />,
          },
          {
            path: "meetings",
            element: <MeetingsPage />,
          },
          {
            path: "polls",
            element: <PollsPage />,
          },

          // ----------------------------------------------
          // SETTINGS
          // ----------------------------------------------

          {
            path: "settings",
            element: (
              <RequireWorkspaceRole check={canViewAdministration}>
                <WorkspaceSettingsPage />
              </RequireWorkspaceRole>
            ),
          },
        ],
      },
    ],
  },

  // ======================================================
  // FALLBACK
  // ======================================================

  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);

export default router;