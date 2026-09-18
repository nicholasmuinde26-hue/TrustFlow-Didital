import React from "react";
import { Outlet } from "react-router-dom";
import CollaborationQuickNav from "../components/CollaborationQuickNav";

// Wraps Messages / Meetings / Polls / Announcements. Staying mounted
// while only the <Outlet /> content swaps is what keeps the quick-nav
// bar on screen when moving between these pages, instead of it
// disappearing per page.
export default function CollaborationLayout() {
  return (
    <div className="space-y-6">
      <CollaborationQuickNav />
      <Outlet />
    </div>
  );
}