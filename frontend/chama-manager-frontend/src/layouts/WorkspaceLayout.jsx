import { useEffect } from "react";
import { Navigate, Outlet, useParams } from "react-router-dom";

import useWorkspace from "@/app/hooks/useWorkspace";
import { getWorkspaceNavigation } from "@/modules/workspaces/config/workspaceNavigation";

import Sidebar from "@/shared/components/layout/sidebar";
import Topbar from "@/shared/components/layout/Topbar";
import Spinner from "@/shared/components/ui/Spinner";

export default function WorkspaceLayout() {
  const { workspaceId } = useParams();
  const { workspaces, activeWorkspace, loading, selectWorkspace } = useWorkspace();

  const matchesId = (w) => (w.id ?? w._id) === workspaceId;

  const workspace = workspaces.find(matchesId) || activeWorkspace;

  useEffect(() => {
    const match = workspaces.find(matchesId);

    if (match && (match.id ?? match._id) !== (activeWorkspace?.id ?? activeWorkspace?._id)) {
      selectWorkspace(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, workspaces]);

  if (loading) {
    return <Spinner fullscreen />;
  }

  // The workspace doesn't exist, or the user doesn't belong to it.
  if (!workspaces.some(matchesId)) {
    return <Navigate to="/home" replace />;
  }

  const sections = getWorkspaceNavigation(workspaceId, workspace?.type);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar sections={sections} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />

        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}