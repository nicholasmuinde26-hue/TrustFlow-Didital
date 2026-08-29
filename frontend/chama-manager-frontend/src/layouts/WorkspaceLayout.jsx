import { useEffect, useState } from "react";
import { Navigate, Outlet, useParams } from "react-router-dom";

import useWorkspace from "@/app/hooks/useWorkspace";
import { getWorkspaceNavigation } from "@/modules/workspaces/config/workspaceNavigation";

import Sidebar from "@/shared/components/layout/sidebar";
import Topbar from "@/shared/components/layout/Topbar";
import Breadcrumbs from "@/shared/components/layout/Breadcrumbs";
import Spinner from "@/shared/components/ui/Spinner";
import ContributionGroupLayout from "./ContributionGroupLayout";

export default function WorkspaceLayout() {
  const { workspaceId } = useParams();
  const { workspaces, activeWorkspace, loading, selectWorkspace } = useWorkspace();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const matchesId = (w) => (w?.id ?? w?._id) === workspaceId;

  // Search in global list, OR fallback to activeWorkspace if created locally on the fly
  const workspace = workspaces.find(matchesId) || activeWorkspace;

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

  const sections = getWorkspaceNavigation(workspaceId, workspace?.type, workspace?.role);

  if (workspace?.type === "contribution-group") {
    return (
      <ContributionGroupLayout
        workspace={workspace}
        workspaceId={workspaceId}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Sidebar Overlay (Mobile) & Persistent Sidebar (Desktop) */}
      <Sidebar
        sections={sections}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="sticky top-0 z-30">
          <Topbar onMenuToggle={() => setSidebarOpen(true)} />
        </div>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>
    </div>
  );
}