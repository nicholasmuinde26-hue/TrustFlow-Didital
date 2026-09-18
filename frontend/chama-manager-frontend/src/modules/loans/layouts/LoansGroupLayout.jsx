import React from "react";
import { Outlet } from "react-router-dom";
import LoansQuickNav from "../components/LoansQuickNav";

// Wraps Loans / Trust Score / Trust Timeline. Staying mounted while
// only the <Outlet /> content swaps is what keeps the quick-nav bar
// on screen when moving between these pages.
export default function LoansGroupLayout() {
  return (
    <div className="space-y-6">
      <LoansQuickNav />
      <Outlet />
    </div>
  );
}