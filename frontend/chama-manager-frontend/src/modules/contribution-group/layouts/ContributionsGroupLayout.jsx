import React from "react";
import { Outlet } from "react-router-dom";
import ContributionsQuickNav from "../components/ContributionsQuickNav";

// Wraps Contributions / Schedule / Activity / Updates. Staying mounted
// while only the <Outlet /> content swaps is what keeps the quick-nav
// bar on screen when moving between these pages.
export default function ContributionsGroupLayout() {
  return (
    <div className="space-y-6">
      <ContributionsQuickNav />
      <Outlet />
    </div>
  );
}