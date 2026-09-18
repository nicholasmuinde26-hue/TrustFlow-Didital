import { createBrowserRouter, Navigate } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";
import GuestRoute from "./GuestRoute";
import RequireAdminRoute from "./RequireAdminRoute";

import AdminLayout from "@/modules/admin/layouts/AdminLayout";
import AdminDashboardPage from "@/modules/admin/pages/AdminDashboardPage";
import AdminRequestsPage from "@/modules/admin/pages/AdminRequestsPage";
import AdminSubAdminsPage from "@/modules/admin/pages/AdminSubAdminsPage";
import AdminCreateEntityPage from "@/modules/admin/pages/AdminCreateEntityPage";
import AdminDirectoryPage from "@/modules/admin/pages/AdminDirectoryPage";
import AdminEntityDetailPage from "@/modules/admin/pages/AdminEntityDetailPage";
import AdminPeoplePage from "@/modules/admin/pages/AdminPeoplePage";
import AdminInquiriesPage from "@/modules/admin/pages/AdminInquiriesPage";
import AdminActivityPage from "@/modules/admin/pages/AdminActivityPage";
import SecurityCommandCenterPage from "@/modules/security/pages/SecurityCommandCenterPage";


import PlatformLayout from "@/layouts/PlatformLayout";
import WorkspaceLayout from "@/layouts/WorkspaceLayout";
import FinanceBooksLayout from "@/modules/finance/layouts/FinanceBooksLayout";
import MoneyCollectionsLayout from "@/modules/finance/layouts/MoneyCollectionsLayout";
import ContributionsGroupLayout from "@/modules/contribution-group/layouts/ContributionsGroupLayout";
import LoansGroupLayout from "@/modules/loans/layouts/LoansGroupLayout";
import GovernanceLayout from "@/modules/leadership/layouts/GovernanceLayout";

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
import { canViewAdministration, canViewLeadershipDesk } from "@/modules/workspaces/permissions/Permissions";
import LegacyLeadershipRedirect from "@/modules/leadership/components/LegacyLeadershipRedirect";

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
import BusinessMarketplacePage from "@/modules/business/pages/BusinessMarketplacePage";

// ======================================================
// Marketplace Hubs & Public Discovery
// ======================================================

import MarketplaceHomePage from "@/modules/marketplace/pages/MarketplaceHomePage";
import MarketplaceCategoryPage from "@/modules/marketplace/pages/MarketplaceCategoryPage";
import MarketplaceListingDetailPage from "@/modules/marketplace/pages/MarketplaceListingDetailPage";
import MarketplacePublicBusinessPage from "@/modules/marketplace/pages/MarketplacePublicBusinessPage";
import MarketplaceOrderTrackPage from "@/modules/marketplace/pages/MarketplaceOrderTrackPage";
import MarketplaceAdminConsole from "@/modules/admin/pages/MarketplaceAdminConsole";

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
import CollaborationLayout from "@/modules/chat/layouts/CollaborationLayout";
import MeetingsPage from "@/modules/meetings/pages/MeetingsPage";
import PollsPage from "@/modules/polls/pages/PollsPage";

// ======================================================
// Chama Module
// ======================================================

import LoansPage from "@/modules/loans/pages/LoansPage";
import ReportsPage from "@/modules/chama/pages/ReportsPage";
import TrustTimelinePage from "@/modules/audit/pages/TrustTimelinePage";
import TrustScorePage from "@/modules/trustScore/pages/TrustScorePage";
import PublicTrustScorePage from "@/modules/trustScore/pages/PublicTrustScorePage";
import DisputesPage from "@/modules/disputes/pages/DisputesPage";
import OfficialAccountabilityPage from "@/modules/officials/pages/OfficialAccountabilityPage";
import ChamaFinancePage from "@/modules/chama/pages/FinancePage";
import MerryGoRoundPage from "@/modules/chama/pages/MerryGoRoundPage";
import ChamaContributionsPage from "@/modules/chama/pages/ChamaContributionsPage";
// The Command Center and the old link-list Leadership Desk are gone —
// both are now tabs inside the single merged desk below. Their routes
// survive as redirects (LegacyLeadershipRedirect) so bookmarks and
// in-app links that still point at /command-center keep working.
import LeadershipDeskPage from "@/modules/leadership/pages/LeadershipDeskPage";
import MyChamaRouterPage from "@/modules/workspaces/pages/MyChamaRouterPage";

// ======================================================
// Burial Chama Module
// ======================================================

import BurialChamaSetupPage from "@/modules/burialChama/pages/BurialChamaSetupPage";
import BeneficiariesPage from "@/modules/burialChama/pages/BeneficiariesPage";
import BurialCasesPage from "@/modules/burialChama/pages/BurialCasesPage";
import MemberStatementPage from "@/modules/burialChama/pages/MemberStatementPage";
import EquipmentHirePage from "@/modules/burialChama/pages/EquipmentHirePage";
import FundraisingPage from "@/modules/burialChama/pages/FundraisingPage";

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
import BankAccountsPage from "@/modules/finance/pages/BankAccountsPage";
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

  // ======================================================
  // PUBLIC MARKETPLACE (Category Hubs & Multi-Vendor Discovery)
  // ======================================================

  {
    path: "/marketplace",
    element: <MarketplaceHomePage />,
  },
  {
    path: "/marketplace/track",
    element: <MarketplaceOrderTrackPage />,
  },
  {
    path: "/marketplace/:categorySlug",
    element: <MarketplaceCategoryPage />,
  },
  {
    path: "/marketplace/:category/products/:slug",
    element: <MarketplaceListingDetailPage />,
  },
  {
    path: "/marketplace/:category/listings/:slug",
    element: <MarketplaceListingDetailPage />,
  },
  {
    path: "/businesses/:businessSlug",
    element: <MarketplacePublicBusinessPage />,
  },

  // Public Chama Trust Score share link (e.g. /trust-score/:token) — a
  // bank, SACCO federation, or prospective member opens this with no
  // login. See modules/trustScore/pages/PublicTrustScorePage.jsx.
  {
    path: "/trust-score/:token",
    element: <PublicTrustScorePage />,
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
      // ADMIN PANEL (Super Admin & Sub-Admin Shell)
      // ==================================================

      {
        path: "/admin",
        element: <RequireAdminRoute />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              {
                index: true,
                element: <AdminDashboardPage />,
              },
              {
                path: "security",
                element: <SecurityCommandCenterPage />,
              },
              {
                path: "requests",
                element: <AdminRequestsPage />,
              },
              {
                path: "sub-admins",
                element: <AdminSubAdminsPage />,
              },
              {
                path: "activity",
                element: <AdminActivityPage />,
              },
              {
                path: "create",
                element: <AdminCreateEntityPage />,
              },
              {
                path: "inquiries",
                element: <AdminInquiriesPage />,
              },
              {
                path: "marketplace",
                element: <MarketplaceAdminConsole />,
              },
              {
                path: "directory",
                element: <AdminDirectoryPage />,
              },
              {
                path: "directory/:type/:id",
                element: <AdminEntityDetailPage />,
              },
              {
                path: "people",
                element: <AdminPeoplePage />,
              },
            ],

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
            element: <Navigate to="../business/marketplace" replace />,
          },
          {
            path: "business/marketplace",
            element: <BusinessMarketplacePage />,
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

          // Contributions / Schedule / Activity / Updates share one
          // persistent "Quick actions · Contributions" nav bar,
          // rendered once by ContributionsGroupLayout so it stays on
          // screen while jumping between these pages.
          {
            element: <ContributionsGroupLayout />,
            children: [
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
            ],
          },

          // ----------------------------------------------
          // CHAMA OPERATIONS
          // ----------------------------------------------

          // Loans / Trust Score / Trust Timeline share one persistent
          // "Quick actions · Loans" nav bar, rendered once by
          // LoansGroupLayout so it stays on screen while jumping
          // between these pages.
          {
            element: <LoansGroupLayout />,
            children: [
              {
                path: "loans",
                element: <LoansPage />,
              },
              {
                path: "trust-timeline",
                element: <TrustTimelinePage />,
              },
              {
                path: "trust-score",
                element: <TrustScorePage />,
              },
            ],
          },
          {
            path: "reports",
            element: <ReportsPage />,
          },
          {
            path: "chama-finance",
            element: <ChamaFinancePage />,
          },
          // Legacy route. The Command Center's tabs are now the desk's
          // Overview / Treasury Oversight / Members & Officials tabs;
          // send arrivals to Overview rather than 404-ing them.
          {
            path: "command-center",
            element: <LegacyLeadershipRedirect tab="overview" />,
          },
          // Members / Officials / Leadership Desk / Disputes share one
          // persistent "Quick actions · People & governance" nav bar,
          // rendered once by GovernanceLayout so it stays on screen
          // while jumping between these pages.
          {
            element: <GovernanceLayout />,
            children: [
              {
                path: "members",
                element: <MembersPage />,
              },
              {
                path: "officials",
                element: <OfficialAccountabilityPage />,
              },
              {
                path: "leadership",
                element: (
                  <RequireWorkspaceRole check={canViewLeadershipDesk}>
                    <LeadershipDeskPage />
                  </RequireWorkspaceRole>
                ),
              },
              {
                path: "disputes",
                element: <DisputesPage />,
              },
            ],
          },
          {
            path: "my-chama",
            element: <MyChamaRouterPage />,
          },

          // ----------------------------------------------
          // BURIAL CHAMA MODULE
          // ----------------------------------------------

          {
            path: "burial-chama-setup",
            element: <BurialChamaSetupPage />,
          },
          {
            path: "beneficiaries",
            element: <BeneficiariesPage />,
          },
          {
            path: "burial-cases",
            element: <BurialCasesPage />,
          },
          {
            path: "member-statement",
            element: <MemberStatementPage />,
          },
          {
            path: "equipment-hire",
            element: <EquipmentHirePage />,
          },
          {
            path: "fundraising",
            element: <FundraisingPage />,
          },

          // ----------------------------------------------
          // FINANCE ENGINE
          // ----------------------------------------------

          // Dashboard / Contributions / Record Contribution / Savings /
          // MGR / Chama Contributions / Payouts / Savings Share-Out
          // share one persistent "Quick actions" nav bar, rendered once
          // by MoneyCollectionsLayout so it stays on screen while
          // jumping between these pages instead of disappearing per
          // page.
          {
            element: <MoneyCollectionsLayout />,
            children: [
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
                path: "finance/savings",
                element: <SavingsPage />,
              },
              // "Savings Share-Out" is its own sidebar link
              // (workspaceNavigation.js) but not a separate page — it's the
              // "shareout" tab of SavingsPage. Route it to the same
              // component so the URL, the active sidebar highlight, and the
              // in-page tab all agree with each other.
              {
                path: "finance/savings-shareout",
                element: <SavingsPage />,
              },
              {
                path: "finance/payouts",
                element: <PayoutsPage />,
              },
              {
                path: "mgr",
                element: <MerryGoRoundPage />,
              },
              {
                path: "chama-contributions",
                element: <ChamaContributionsPage />,
              },
            ],
          },
          // Books of accounts: these all share one persistent
          // "Quick actions · Books of accounts" nav bar, rendered once
          // by FinanceBooksLayout so it stays on screen while jumping
          // between books instead of disappearing per page.
          {
            element: <FinanceBooksLayout />,
            children: [
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
                path: "finance/bank-accounts",
                element: <BankAccountsPage />,
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
            ],
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

          // Messages / Meetings / Polls / Announcements share one
          // persistent quick-nav bar, rendered once by
          // CollaborationLayout so it stays on screen while jumping
          // between these pages instead of disappearing per page.
          {
            element: <CollaborationLayout />,
            children: [
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
            ],
          },

          // ----------------------------------------------
          // SETTINGS
          // ----------------------------------------------

          // For a Chama this is now the desk's "Governance Settings"
          // tab; LegacyLeadershipRedirect forwards there and leaves
          // non-Chama workspaces (Contribution Groups, which have no
          // Leadership Desk) on the standalone settings page.
          {
            path: "settings",
            element: (
              <RequireWorkspaceRole check={canViewAdministration}>
                <LegacyLeadershipRedirect tab="governance">
                  <WorkspaceSettingsPage />
                </LegacyLeadershipRedirect>
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