import { useContext } from "react";
import WorkspaceContext from "@/app/store/workspace.store";

const FAMILY_LABELS = { chama: "Chama", sacco: "SACCO", cooperative: "Cooperative" };
export const organizationLabel = (family, custom = "") => custom && custom !== "Chama" ? custom : FAMILY_LABELS[family] || "Organization";

/** Workspace-aware language for UI copy. Stable module keys stay internal;
 * only their organization-specific display labels change. */
export default function useTerminology() {
  const context = useContext(WorkspaceContext);
  const currentWorkspace = context?.activeWorkspace || context?.currentWorkspace || context?.workspace || null;
  const config = currentWorkspace?.config?.terminology || {};
  const family = currentWorkspace?.organizationFamily || "chama";
  const workspace = organizationLabel(family, config.workspace);
  const moduleLabels = config.module_labels || {};
  const moduleLabel = (key, fallback = key) => moduleLabels[key] || fallback;
  const organizationTerm = (text = "") => typeof text !== "string" ? text : text.replace(/\bchamas?\b/gi, (match) => {
    const plural = family === "sacco" ? "SACCOs" : family === "cooperative" ? "Cooperatives" : family === "chama" ? "Chamas" : `${workspace}s`;
    const replacement = match.toLowerCase().endsWith("s") ? plural : workspace;
    return match[0] === match[0].toUpperCase() ? replacement : replacement.toLocaleLowerCase();
  });

  return {
    workspace,
    workspaceLower: workspace.toLocaleLowerCase(),
    workspacePlural: family === "chama" ? "Chamas" : family === "sacco" ? "SACCOs" : family === "cooperative" ? "Cooperatives" : `${workspace}s`,
    organizationType: currentWorkspace?.organizationType || "custom",
    moduleLabels,
    moduleLabel,
    organizationTerm,
  };
}
