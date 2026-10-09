import { Outlet } from "react-router-dom";

// Wraps Loans / Trust Score / Trust Timeline.
//
// This used to render its own "Quick actions" bar above the page, which
// stacked on top of the workspace SectionTabs bar. Navigation between
// these pages now comes from SectionTabs alone (driven by
// workspaceNavigation.js), so this layout just renders the page.
export default function LoansGroupLayout() {
  return <Outlet />;
}