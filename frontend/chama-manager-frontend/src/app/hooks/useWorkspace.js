import { useContext } from "react";
import WorkspaceContext from "../store/workspace.store";

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error(
      "useWorkspace must be used inside a WorkspaceProvider."
    );
  }

  const currentWorkspace =
    context.activeWorkspace ||
    context.currentWorkspace ||
    context.workspace ||
    null;
  const workspaceId = currentWorkspace?._id || currentWorkspace?.id || context.workspaceId || null;
  const workspaceType = (currentWorkspace?.type || context.workspaceType || "").toLowerCase();

  return {
    ...context,
    currentWorkspace,
    workspaceId,
    workspaceType,
    // Burial chamas are still Chama documents underneath (same
    // governance/settings/membership model) — just with an extra
    // BurialChamaProfile layered on top — so anything gated on "is
    // this a Chama-backed workspace" (settings, savings deposits,
    // etc.) should treat both the same. Use isBurialChama where the
    // distinction actually matters (e.g. sidebar nav).
    isChama: workspaceType === "chama" || workspaceType === "burial-chama",
    isBurialChama: workspaceType === "burial-chama",
    isBusiness: workspaceType === "business",
    isContributionGroup:
      workspaceType === "contribution-group" ||
      workspaceType === "contribution_group" ||
      workspaceType === "merry_go_round" ||
      workspaceType === "contribution",
  };
}

export default useWorkspace;