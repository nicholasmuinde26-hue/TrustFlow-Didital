import React from "react";
import { Outlet } from "react-router-dom";
import GovernanceQuickNav from "../components/GovernanceQuickNav";

// Wraps Members / Officials / Leadership Desk / Disputes. Staying
// mounted while only the <Outlet /> content swaps is what keeps the
// quick-nav bar on screen when moving between these pages.
export default function GovernanceLayout() {
  return (
    <div className="space-y-6">
      <GovernanceQuickNav />
      <Outlet />
    </div>
  );
}