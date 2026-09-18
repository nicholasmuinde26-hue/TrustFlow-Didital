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

  // The viewer's own membership within the active workspace (chama /
  // contribution group). Several screens — e.g. the loan approvals queue's
  // conflict-of-interest recusal check — need to know "is this the current
  // viewer's own record?" and compare against membership._id, so this must
  // reflect the real membership id rather than being left undefined.
  const membershipId = currentWorkspace?.membershipId || context.membership?._id || null;
  const membership = membershipId ? { ...context.membership, _id: membershipId } : context.membership;

  return {
    ...context,
    currentWorkspace,
    workspaceId,
    workspaceType,
    membership,
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