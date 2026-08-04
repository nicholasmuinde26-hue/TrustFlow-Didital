import { useParams } from "react-router-dom";

import useWorkspace from "@/app/hooks/useWorkspace";

export default function WorkspaceOverviewPage() {
  const { workspaceId } = useParams();
  const { workspaces } = useWorkspace();

  const workspace = workspaces.find(
    (w) => (w.id ?? w._id) === workspaceId
  );

  const isChama = workspace?.type === "chama";

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
        {workspace?.name || "Workspace"}
      </h1>

      <p className="mt-2 text-slate-500 dark:text-slate-400">
        {isChama
          ? "Chama overview coming soon — contributions, loan book and cash position at a glance."
          : "Contribution group overview coming soon — progress, countdown and recent activity at a glance."}
      </p>
    </div>
  );
}