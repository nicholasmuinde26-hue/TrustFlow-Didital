import { useContext } from "react";
import WorkspaceContext from "../store/workspace.store";

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error(
      "useWorkspace must be used inside a WorkspaceProvider."
    );
  }

  const currentWorkspace = context.currentWorkspace || context.workspace || null;
  const workspaceId = currentWorkspace?._id || currentWorkspace?.id || context.workspaceId || null;
  const workspaceType = (currentWorkspace?.type || context.workspaceType || "").toLowerCase();

  return {
    ...context,
    currentWorkspace,
    workspaceId,
    workspaceType,
    isChama: workspaceType === "chama",
    isBusiness: workspaceType === "business",
    isContributionGroup:
      workspaceType === "contribution_group" ||
      workspaceType === "merry_go_round" ||
      workspaceType === "contribution",
  };
}

export default useWorkspace;