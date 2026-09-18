import React from "react";
import { Outlet } from "react-router-dom";
import MoneyCollectionsQuickNav from "../components/MoneyCollectionsQuickNav";

// Wraps every "Money & Collections" page (Dashboard, Contributions,
// Record Contribution, Savings, MGR, Chama Contributions, Payouts,
// Savings Share-Out). Staying mounted while only the <Outlet />
// content swaps is what keeps the quick-nav bar on screen instead of
// it disappearing per page when navigating between tabs.
export default function MoneyCollectionsLayout() {
  return (
    <div className="space-y-6">
      <MoneyCollectionsQuickNav />
      <Outlet />
    </div>
  );
}