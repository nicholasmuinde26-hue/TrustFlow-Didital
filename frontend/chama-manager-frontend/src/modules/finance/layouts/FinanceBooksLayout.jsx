import React from "react";
import { Outlet } from "react-router-dom";
import BooksOfAccountsNav from "../components/BooksOfAccountsNav";

// Wraps every "book of accounts" page (Transactions, Ledger, Wallet,
// Bank Accounts, Trial Balance, Balance Sheet, Income Statement, Cash
// Flow). Because this layout — and the nav bar it renders — stays
// mounted while only the <Outlet /> content underneath swaps out,
// clicking between books no longer makes the bar disappear.
export default function FinanceBooksLayout() {
  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-mist pb-12">
      <BooksOfAccountsNav />
      <Outlet />
    </div>
  );
}