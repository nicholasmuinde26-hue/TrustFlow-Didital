import { Navigate, useParams } from "react-router-dom";

import useWorkspace from "@/app/hooks/useWorkspace";
import Spinner from "@/shared/components/ui/Spinner";

/**
 * Gates a workspace route behind a feature module the chama may have
 * switched off (loans, polls, MGR ...). Deep links and bookmarks to a
 * disabled page redirect to the workspace home instead of rendering a page
 * whose API calls the backend now refuses (403 MODULE_DISABLED).
 *
 * Usage (router.jsx):
 *   { path: "loans", element: <RequireModule module="loans"><LoansPage /></RequireModule> }
 *
 * `module` is a key from the backend catalog; `anyOf` lets a page that serves
 * several modules stay reachable while at least one of them is on.
 *
 * Only chama-backed workspaces carry a module list. For businesses and
 * contribution groups `workspace.modules` is undefined, which means "no
 * module information" - nothing is hidden, so this wrapper is a no-op there.
 *
 * The redirect carries `state.moduleDisabled` so the overview can say why.
 */
export default function RequireModule({ module, anyOf, children }) {
  const { workspaceId } = useParams();
  const { workspaces = [], activeWorkspace, loading } = useWorkspace();

  if (loading) {
    return <Spinner fullscreen />;
  }

  const matchesId = (w) => (w?.id ?? w?._id) === workspaceId;
  const workspace =
    workspaces.find(matchesId) || (activeWorkspace && matchesId(activeWorkspace) ? activeWorkspace : null);

  // Unknown workspace is WorkspaceLayout's job to redirect; unknown modules
  // (non-chama workspaces, old cached payloads) mean nothing is hidden.
  if (!workspace || !Array.isArray(workspace.modules)) {
    return children;
  }

  const keys = anyOf || [module];
  const allowed = keys.some((key) => workspace.modules.includes(key));

  if (!allowed) {
    return (
      <Navigate
        to={`/workspace/${workspaceId}`}
        replace
        state={{ moduleDisabled: keys[0] }}
      />
    );
  }

  return children;
}
