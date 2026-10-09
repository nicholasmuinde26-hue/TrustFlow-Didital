import { Outlet } from "react-router-dom";

// Wraps every "book of accounts" page (Transactions, Ledger, Wallet, Bank
// Accounts, Trial Balance, Balance Sheet, Income Statement, Cash Flow).
// Navigation between books now comes from the workspace SectionTabs bar
// (see the "Books" section in workspaceNavigation.js); this wrapper only
// keeps the shared page typography and bottom spacing.
export default function FinanceBooksLayout() {
  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-mist pb-12">
      <Outlet />
    </div>
  );
}