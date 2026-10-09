import { useParams } from "react-router-dom";
import { Boxes } from "lucide-react";

import useWorkspace from "@/app/hooks/useWorkspace";
import { isChamaBackedType } from "@/modules/workspaces/config/workspaceModules";

// Opens the all-tools drawer from the top bar (desktop). On phones the menu
// button already does this, so this one stays hidden below the lg breakpoint.
// Only shown for chama-backed workspaces, whose sidebar no longer carries an
// "All tools" button.
export default function ToolsButton({ onOpen }) {
  const { workspaceId } = useParams();
  const { workspaces, activeWorkspace } = useWorkspace();
  const workspace =
    workspaces?.find((w) => (w?.id ?? w?._id) === workspaceId) || activeWorkspace || null;

  if (!workspaceId || !isChamaBackedType(workspace?.type)) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      title="All tools"
      aria-label="Open all workspace tools"
      className="hidden h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:inline-flex dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist dark:hover:bg-obsidian-raised"
    >
      <Boxes size={15} aria-hidden="true" />
      Tools
    </button>
  );
}