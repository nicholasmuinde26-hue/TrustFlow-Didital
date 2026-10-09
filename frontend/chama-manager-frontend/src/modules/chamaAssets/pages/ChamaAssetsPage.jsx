import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";

import useAuth from "@/app/hooks/useAuth";
import useWorkspace from "@/app/hooks/useWorkspace";
import ChamaAssetsPanel from "../components/ChamaAssetsPanel";

export default function ChamaAssetsPage() {
  const { workspaceId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentWorkspace, workspaces } = useWorkspace();
  const { user } = useAuth();
  const [initialAction, setInitialAction] = useState(null);
  const [expanded, setExpanded] = useState(true);
  const clearInitialAction = useCallback(() => setInitialAction(null), []);

  const workspace = workspaces.find((item) => String(item.id ?? item._id) === String(workspaceId)) || currentWorkspace;
  const workspaceType = String(workspace?.type || "").toLowerCase().replace(/[-_]/g, "");
  const isChamaWorkspace = workspaceType === "chama" || workspaceType === "burialchama";
  const role = String(workspace?.role || "").toLowerCase().replaceAll(" ", "_");
  const canManageAssets = ["chairperson", "treasurer"].includes(role);
  const canApproveAssets = ["chairperson", "treasurer", "secretary"].includes(role);
  const activeTab = location.pathname.endsWith("/investments") ? "investments" : "portfolio";

  useEffect(() => {
    const action = searchParams.get("assetAction");
    if (!action) return;
    const proposalRoute = location.pathname.endsWith("/investments");
    if ((action === "proposal") !== proposalRoute) {
      navigate(`/workspace/${workspaceId}/assets${action === "proposal" ? "/investments" : ""}?${searchParams.toString()}`, { replace: true });
      return;
    }
    setInitialAction(action);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("assetAction");
    setSearchParams(nextParams, { replace: true });
    setExpanded(true);
  }, [location.pathname, navigate, searchParams, setSearchParams, workspaceId]);

  if (!isChamaWorkspace) return <Navigate to={`/workspace/${workspaceId}`} replace />;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-slate-200 pb-5 dark:border-obsidian-border">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700 dark:text-mint">{workspace?.name || "Your Chama"}</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-mist">Assets &amp; investments</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-mist-muted">Manage the group portfolio, proposals, approvals, and asset activity.</p>
        </div>
        <Link to={`/workspace/${workspaceId}`} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-mist-muted dark:hover:bg-obsidian-card dark:hover:text-mist">
          <ArrowLeft size={16} /> Workspace overview
        </Link>
      </header>

      <ChamaAssetsPanel
        chamaId={workspaceId}
        canManage={canManageAssets}
        canApprove={canApproveAssets}
        currentUserId={user?._id || user?.id}
        open={expanded}
        onToggle={() => setExpanded((value) => !value)}
        activeTab={activeTab}
        initialAction={initialAction}
        onActionHandled={clearInitialAction}
      />
    </div>
  );
}
