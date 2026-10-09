import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";

import useWorkspace from "@/app/hooks/useWorkspace";
import { getWorkspaceNavigation } from "@/modules/workspaces/config/workspaceNavigation";
import {
  isChamaBackedType,
  isPathEnabled,
  moduleForPath,
  relativeWorkspacePath,
} from "@/modules/workspaces/config/workspaceModules";

import Sidebar from "@/shared/components/layout/sidebar";
import Topbar from "@/shared/components/layout/Topbar";
import Breadcrumbs from "@/shared/components/layout/Breadcrumbs";
import Spinner from "@/shared/components/ui/Spinner";
import ContributionGroupLayout from "./ContributionGroupLayout";
import { AiAssistantWidget } from "@/modules/ai";
import WorkspaceQuickLaunchers from "@/modules/workspaces/components/WorkspaceQuickLaunchers";
import GlBalanceGuard from "@/modules/finance/components/GlBalanceGuard";
import BillingBanner from "@/modules/billing/components/BillingBanner";
import useBillingSummary from "@/modules/billing/hooks/useBilling";
import { isModuleLocked, markLockedItems } from "@/modules/billing/utils/planLocks";
import MobileBottomNav from "@/shared/components/layout/MobileBottomNav/MobileBottomNav";
import SectionTabs from "@/shared/components/layout/SectionTabs/SectionTabs";
import { useClearNotificationsOnVisit } from "@/modules/notifications/hooks/useNotifications";
import { getLeadershipDeskItem } from "@/modules/workspaces/config/workspaceNavigation";


export default function WorkspaceLayout() {
  const { workspaceId } = useParams();
  const { pathname, search } = useLocation();
  const { workspaces, activeWorkspace, loading, selectWorkspace } = useWorkspace();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Opening a page clears the badge on its nav icon / section tab.
  useClearNotificationsOnVisit();

  const matchesId = (w) => (w?.id ?? w?._id) === workspaceId;

  // Search in global list, OR fallback to activeWorkspace if created locally on the fly
  const workspace = workspaces.find(matchesId) || activeWorkspace;

  // What the chama's subscription plan includes. Must stay above the early
  // returns below (hooks). Nothing is locked until the server says billing is
  // enforced and the summary has loaded.
  const { summary: billing } = useBillingSummary(workspaceId, isChamaBackedType(workspace?.type));

  useEffect(() => {
    const match = workspaces.find(matchesId);

    if (
      match &&
      (match.id ?? match._id) !== (activeWorkspace?.id ?? activeWorkspace?._id)
    ) {
      selectWorkspace(match);
    }
  }, [workspaceId, workspaces]);

  if (loading) {
    return <Spinner fullscreen />;
  }

  // FIX: Allow access if workspace is found in `workspaces` OR matches `activeWorkspace`
  const hasWorkspace = workspaces.some(matchesId) || (activeWorkspace && matchesId(activeWorkspace));

  if (!hasWorkspace) {
    return <Navigate to="/home" replace />;
  }

  // Route guard: a chama that switched a module off must not be reachable by
  // typing or bookmarking its URL either. Send them to the workspace home.
  // (The backend refuses the API calls too - this just avoids a broken page.)
  if (
    isChamaBackedType(workspace?.type) &&
    !isPathEnabled(workspace?.modules, relativeWorkspacePath(pathname, workspaceId))
  ) {
    return (
      <Navigate
        to={`/workspace/${workspaceId}`}
        replace
        state={{ moduleDisabled: moduleForPath(relativeWorkspacePath(pathname, workspaceId)) }}
      />
    );
  }

  // Plan lock: a feature outside the chama's plan sends people to the plan
  // page instead of opening. "View existing records" on that page adds
  // ?readonly=1, which the server already allows (reads are never blocked).
  if (isChamaBackedType(workspace?.type) && !new URLSearchParams(search).has("readonly")) {
    const relativePath = relativeWorkspacePath(pathname, workspaceId);
    const lockedModule = moduleForPath(relativePath);
    if (lockedModule && isModuleLocked(billing, lockedModule)) {
      return (
        <Navigate
          to={`/workspace/${workspaceId}/billing?unlock=${lockedModule}&from=${encodeURIComponent(relativePath)}`}
          replace
        />
      );
    }
  }

  const sections = markLockedItems(
    getWorkspaceNavigation(
      workspaceId,
      workspace?.type,
      workspace?.role,
      workspace?.category,
      workspace?.workspaceSettings,
      workspace?.modules
    ),
    isChamaBackedType(workspace?.type) ? billing : null
  );
  const leadershipItem = getLeadershipDeskItem(workspaceId, workspace?.type, workspace?.role);

  if (workspace?.type === "contribution-group") {
    return (
      <ContributionGroupLayout
        workspace={workspace}
        workspaceId={workspaceId}
      />
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-[#f5f8f6] dark:bg-obsidian">
      {/* Compact app rail with an on-demand, role-filtered all-tools drawer. */}
      <Sidebar
        sections={sections}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpen={() => setSidebarOpen(true)}
        workspace={workspace}
        workspaceId={workspaceId}
      />

      {/* Main Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="sticky top-0 z-30">
          <Topbar onMenuToggle={() => setSidebarOpen(true)} />
        </div>

        {/* The single section tab bar. Lives outside <main> so it never
            scrolls over the breadcrumbs / page content. */}
        <SectionTabs sections={sections} />

        <main className="workspace-page-container min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-4 pb-20 sm:p-5 sm:pb-24 lg:p-8 lg:pb-8">
          <Breadcrumbs sections={sections} />
          <BillingBanner workspace={workspace} workspaceId={workspaceId} />
          <Outlet />
        </main>
      </div>

      {/* Mobile-only: keeps Home/Workspaces/Messages/Profile reachable
          from inside a workspace too, matching every mobile screen in
          the Doc1 mockups (the desktop icon rail stays lg:flex-only). */}
      <MobileBottomNav sections={sections} extraItems={leadershipItem ? [leadershipItem] : []} />

      <WorkspaceQuickLaunchers workspaceId={workspaceId} workspaceType={workspace?.type} />

      <AiAssistantWidget
        workspaceId={workspaceId}
        workspaceType={workspace?.type}
        workspaceName={workspace?.name}
      />

      {/* Chama-only: general ledger double-entry integrity is the one thing
          that should never silently go wrong. Not mounted for business/
          contribution-group workspaces per the current scope. */}
      {workspace?.type === "chama" && (
        <GlBalanceGuard workspaceId={workspaceId} workspaceName={workspace?.name} />
      )}
    </div>
  );
}
