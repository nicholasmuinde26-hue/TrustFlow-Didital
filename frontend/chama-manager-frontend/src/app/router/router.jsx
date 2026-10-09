import { createBrowserRouter, Navigate } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";
import GuestRoute from "./GuestRoute";
import RequireAdminRoute from "./RequireAdminRoute";

import AdminLayout from "@/modules/admin/layouts/AdminLayout";
import AdminDashboardPage from "@/modules/admin/pages/AdminDashboardPage";
import AdminRequestsPage from "@/modules/admin/pages/AdminRequestsPage";
import AdminChamaKycPage from "@/modules/admin/pages/AdminChamaKycPage";
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
import RequireModule from "@/shared/components/routing/RequireModule";
import { canViewAdministration, canViewLeadershipDesk, canManageBurialChamaSetup } from "@/modules/workspaces/permissions/Permissions";
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
import AdminRevenuePage from "@/modules/admin/pages/AdminRevenuePage";
import AdminSupportPage from "@/modules/admin/pages/AdminSupportPage";
import AdminSupportChamaPage from "@/modules/admin/pages/AdminSupportChamaPage";
import AdminSupportUserPage from "@/modules/admin/pages/AdminSupportUserPage";
import AdminSupportCasePage from "@/modules/admin/pages/AdminSupportCasePage";
import BillingPage from "@/modules/billing/pages/BillingPage";

// ======================================================
// Public cause preview (no auth)
// ======================================================

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
import NotificationCenterPage from "@/modules/notifications/pages/NotificationCenterPage";
import NotificationPreferencesPage from "@/modules/notifications/pages/NotificationPreferencesPage";

// ======================================================
// Chama Module
// ======================================================

import LoansPage from "@/modules/loans/pages/LoansPage";
import WithdrawalsPage from "@/modules/withdrawal/pages/WithdrawalsPage";
import ReportsPage from "@/modules/chama/pages/ReportsPage";
import TrustTimelinePage from "@/modules/audit/pages/TrustTimelinePage";
import TrustScorePage from "@/modules/trustScore/pages/TrustScorePage";
import PublicTrustScorePage from "@/modules/trustScore/pages/PublicTrustScorePage";
import DisputesPage from "@/modules/disputes/pages/DisputesPage";
import OfficialAccountabilityPage from "@/modules/officials/pages/OfficialAccountabilityPage";
import ChamaFinancePage from "@/modules/chama/pages/FinancePage";
import ChamaAssetsPage from "@/modules/chamaAssets/pages/ChamaAssetsPage";
import BusinessFundsPage from "@/modules/chamaAssets/pages/BusinessFundsPage";
import MerryGoRoundPage from "@/modules/chama/pages/MerryGoRoundPage";
import ChamaContributionsPage from "@/modules/chama/pages/ChamaContributionsPage";
import PublicChamaProfilePage from "@/modules/chama/pages/PublicChamaProfilePage";
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

import MoneyDashboardPage from "@/modules/finance/pages/MoneyDashboardPage";
import MyWalletPage from "@/modules/finance/pages/MyWalletPage";
import RecordContributionPage from "@/modules/finance/pages/RecordContributionPage";
import FinanceContributionsPage from "@/modules/finance/pages/ContributionsPage";
import ContributionRegisterPage from "@/modules/finance/pages/ContributionRegisterPage";
import TransactionsPage from "@/modules/finance/pages/TransactionsPage";
import LedgerPage from "@/modules/finance/pages/LedgerPage";
import FinanceAccountsPage from "@/modules/finance/pages/AccountsPage";
import BankAccountsPage from "@/modules/finance/pages/BankAccountsPage";
import AdjustmentsPage from "@/modules/finance/pages/AdjustmentsPage";
import ReconciliationPage from "@/modules/finance/pages/ReconciliationPage";
import ReconciliationSessionPage from "@/modules/finance/pages/ReconciliationSessionPage";
import SavingsPage from "@/modules/finance/pages/SavingsPage";
import SavingsShareoutPage from "@/modules/finance/pages/SavingsShareoutPage";
import TrialBalancePage from "@/modules/finance/pages/TrialBalancePage";
import BalanceSheetPage from "@/modules/finance/pages/BalanceSheetPage";
import IncomeStatementPage from "@/modules/finance/pages/IncomeStatementPage";
import CashFlowStatementPage from "@/modules/finance/pages/CashFlowStatementPage";
import ReceiptsPaymentsPage from "@/modules/finance/pages/ReceiptsPaymentsPage";
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
  // PUBLIC MARKETPLACE (Category Hubs & Multi-Vendor Discovery)
  // ======================================================

  {
    path: "/marketplace",
    element: <Navigate to="/marketplace/retail" replace />,
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
  { path: "/chama-profile/:chamaId", element: <PublicChamaProfilePage /> },

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
                path: "chama-kyc",
                element: <AdminChamaKycPage />,
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
              // Support Desk: billing help, payment review, user tools, notes & cases.
              // The server enforces the Support / Finance permissions.
              {
                path: "support",
                element: <AdminSupportPage />,
              },
              {
                path: "support/chamas/:chamaId",
                element: <AdminSupportChamaPage />,
              },
              {
                path: "support/users/:userId",
                element: <AdminSupportUserPage />,
              },
              {
                path: "support/cases/:caseId",
                element: <AdminSupportCasePage />,
              },
              {
                path: "marketplace",
                element: <MarketplaceAdminConsole />,
              },
              {
                // Platform income is the owner's business: Super Admin only.
                element: <RequireAdminRoute requireSuperAdmin />,
                children: [
                  {
                    path: "revenue",
                    element: <AdminRevenuePage />,
                  },
                ],
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
          {
            path: "assets/income",
            element: (
              <RequireModule module="assets">
                <BusinessFundsPage />
              </RequireModule>
            ),
          },
          {
            path: "assets/investments",
            element: (
              <RequireModule module="assets">
                <ChamaAssetsPage />
              </RequireModule>
            ),
          },
          {
            path: "assets",
            element: (
              <RequireModule module="assets">
                <ChamaAssetsPage />
              </RequireModule>
            ),
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
                element: (
                  <RequireModule module="contributions">
                    <ContributionsPage />
                  </RequireModule>
                ),
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
                element: (
                  <RequireModule module="loans">
                    <LoansPage />
                  </RequireModule>
                ),
              },
              {
                path: "trust-timeline",
                element: (
                  <RequireModule module="trust">
                    <TrustTimelinePage />
                  </RequireModule>
                ),
              },
              {
                path: "trust-score",
                element: (
                  <RequireModule module="trust">
                    <TrustScorePage />
                  </RequireModule>
                ),
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
                element: (
                  <RequireModule module="officials">
                    <OfficialAccountabilityPage />
                  </RequireModule>
                ),
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
                element: (
                  <RequireModule module="disputes">
                    <DisputesPage />
                  </RequireModule>
                ),
              },
            ],
          },
          {
            path: "my-chama",
            element: <MyChamaRouterPage />,
          },

          // Plan and billing: what the chama pays the platform. Members can
          // open it (they see the plan and who to ask); only the treasurer
          // and chairperson get the controls.
          {
            path: "billing",
            element: <BillingPage />,
          },

          // ----------------------------------------------
          // BURIAL CHAMA MODULE
          // ----------------------------------------------

          {
            path: "burial-chama-setup",
            element: (
              <RequireModule module="burial_welfare">
                <RequireWorkspaceRole check={canManageBurialChamaSetup}>
                <BurialChamaSetupPage />
              </RequireWorkspaceRole>
              </RequireModule>
            ),
          },
          {
            path: "beneficiaries",
            element: (
              <RequireModule module="burial_welfare">
                <BeneficiariesPage />
              </RequireModule>
            ),
          },
          {
            path: "burial-cases",
            element: (
              <RequireModule module="burial_welfare">
                <BurialCasesPage />
              </RequireModule>
            ),
          },
          {
            path: "member-statement",
            element: (
              <RequireModule module="burial_welfare">
                <MemberStatementPage />
              </RequireModule>
            ),
          },
          {
            path: "equipment-hire",
            element: (
              <RequireModule module="equipment_hire">
                <EquipmentHirePage />
              </RequireModule>
            ),
          },
          {
            path: "fundraising",
            element: (
              <RequireModule module="fundraising">
                <FundraisingPage />
              </RequireModule>
            ),
          },

          // ----------------------------------------------
          // FINANCE ENGINE
          // ----------------------------------------------

          // Money & Contributions. Five top-level tabs (Treasury,
          // Contributions, Savings, Merry-Go-Round, Payouts); the pages
          // that used to be separate tabs now sit under their parent as
          // sub-tabs, rendered once by MoneyCollectionsLayout:
          //   Contributions -> Record payment, Register, Fundraisers
          //   Savings       -> Share-out
          //   Payouts       -> Withdrawals
          {
            element: <MoneyCollectionsLayout />,
            children: [
              {
                path: "finance",
                element: <MoneyDashboardPage />,
              },
              {
                path: "finance/overview",
                element: <MoneyDashboardPage />,
              },
              {
                path: "finance/wallet",
                element: <MyWalletPage />,
              },
              {
                path: "finance/record-contribution",
                element: (
                  <RequireModule module="contributions">
                    <RecordContributionPage />
                  </RequireModule>
                ),
              },
              // Backwards-compatible aliases
              // Contributions is the REGISTER (read): every payment, each
              // member's standing, and the per-plan breakdown. It used to
              // mount RecordContributionPage, so this tab and "Record
              // Contribution" showed the identical payment form and the
              // contribution book had nowhere to live.
              {
                path: "finance/contributions",
                element: (
                  <RequireModule module="contributions">
                    <FinanceContributionsPage />
                  </RequireModule>
                ),
              },
              // The detailed payment register (filters, CSV export) that
              // used to be the Contributions page itself. Reached from the
              // Contributions manager's "Payment register" button.
              {
                path: "finance/contributions/register",
                element: (
                  <RequireModule module="contributions">
                    <ContributionRegisterPage />
                  </RequireModule>
                ),
              },
              // "/new" is the write action, so it keeps pointing at the form.
              {
                path: "finance/contributions/new",
                element: (
                  <RequireModule module="contributions">
                    <RecordContributionPage />
                  </RequireModule>
                ),
              },
              {
                path: "finance/savings",
                element: (
                  <RequireModule module="savings">
                    <SavingsPage />
                  </RequireModule>
                ),
              },
              // Savings Share-Out is now a real page of its own rather than
              // a tab inside SavingsPage. Both links previously mounted the
              // same component, which is why the two nav items looked like
              // one duplicated screen. Savings owns the pool (deposits,
              // balances, growth); Share-Out owns releasing it (policy,
              // batch approval, disbursement).
              {
                path: "finance/savings-shareout",
                element: (
                  <RequireModule module="savings_shareout">
                    <SavingsShareoutPage />
                  </RequireModule>
                ),
              },
              {
                path: "finance/payouts",
                element: (
                  <RequireModule module="payouts">
                    <PayoutsPage />
                  </RequireModule>
                ),
              },
              {
                path: "finance/withdrawals",
                element: (
                  <RequireModule module="withdrawals">
                    <WithdrawalsPage />
                  </RequireModule>
                ),
              },
              {
                path: "mgr",
                element: (
                  <RequireModule module="mgr">
                    <MerryGoRoundPage />
                  </RequireModule>
                ),
              },
              {
                path: "chama-contributions",
                element: (
                  <RequireModule module="contributions">
                    <ChamaContributionsPage />
                  </RequireModule>
                ),
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
                path: "finance/adjustments",
                element: <AdjustmentsPage />,
              },
              {
                path: "finance/reconciliation",
                element: <ReconciliationPage />,
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
                path: "finance/receipts-payments",
                element: <ReceiptsPaymentsPage />,
              },
            ],
          },
          {
            path: "finance/reconciliation/:sessionId",
            element: <ReconciliationSessionPage />,
          },
          {
            path: "finance/payouts/new",
            element: (
              <RequireModule module="payouts">
                <CreatePayoutPage />
              </RequireModule>
            ),
          },
          {
            path: "finance/deposits/new",
            element: <FinanceOperationPage operation="deposit" />,
          },
          {
            path: "finance/withdrawals/new",
            element: (
              <RequireModule module="withdrawals">
                <FinanceOperationPage operation="withdrawal" />
              </RequireModule>
            ),
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
                element: (
                  <RequireModule module="chat">
                    <ChatPage />
                  </RequireModule>
                ),
              },
              {
                path: "announcements",
                element: (
                  <RequireModule module="announcements">
                    <AnnouncementsPage />
                  </RequireModule>
                ),
              },
              {
                path: "meetings",
                element: (
                  <RequireModule module="meetings">
                    <MeetingsPage />
                  </RequireModule>
                ),
              },
              {
                path: "polls",
                element: (
                  <RequireModule module="polls">
                    <PollsPage />
                  </RequireModule>
                ),
              },
            ],
          },

          // ----------------------------------------------
          // NOTIFICATIONS
          // ----------------------------------------------
          {
            path: "notifications",
            element: <NotificationCenterPage />,
          },
          {
            path: "notifications/preferences",
            element: <NotificationPreferencesPage />,
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
