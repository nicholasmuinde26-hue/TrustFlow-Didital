import { Navigate, useParams } from "react-router-dom";

import useWorkspace from "@/app/hooks/useWorkspace";
import Spinner from "@/shared/components/ui/Spinner";

/**
 * Gates an entire workspace route behind a permission check (see
 * modules/workspaces/permissions/Permissions.js), rather than just
 * disabling edit controls on the page.
 *
 * Sensitive management areas — Command Center, Administration/Settings,
 * the Loans Approval queue — should be completely unreachable for a
 * plain member: no nav link (handled in workspaceNavigation.js /
 * ContributionGroupLayout.jsx), and no page content even if they type
 * or bookmark the URL directly. A member landing here is redirected
 * straight back to the workspace overview instead of seeing any part
 * of the page shell.
 *
 * Usage:
 *   <RequireWorkspaceRole check={canViewCommandCenter}>
 *     <ChamaCommandCenterPage />
 *   </RequireWorkspaceRole>
 *
 * `check` receives (role, type) — the same signature every function
 * in Permissions.js uses.
 */
export default function RequireWorkspaceRole({ check, children }) {
  const { workspaceId } = useParams();
  const { workspaces, activeWorkspace, loading } = useWorkspace();

  if (loading) {
    return <Spinner fullscreen />;
  }

  const matchesId = (w) => (w?.id ?? w?._id) === workspaceId;
  const workspace = workspaces.find(matchesId) || (activeWorkspace && matchesId(activeWorkspace) ? activeWorkspace : null);

  const allowed = workspace ? check(workspace.role, workspace.type) : false;

  if (!allowed) {
    return <Navigate to={`/workspace/${workspaceId}`} replace />;
  }

  return children;
}
