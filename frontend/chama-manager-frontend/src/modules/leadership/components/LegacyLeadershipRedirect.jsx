import { Navigate, useParams } from "react-router-dom";

import useWorkspace from "@/app/hooks/useWorkspace";
import Spinner from "@/shared/components/ui/Spinner";
import { canViewLeadershipDesk } from "@/modules/workspaces/permissions/Permissions";

// ========================================
// LEGACY LEADERSHIP ROUTE REDIRECT
// ========================================
//
// Merging three surfaces into one page means three sets of URLs that
// people have bookmarked, pasted into WhatsApp groups, and linked from
// old notifications. Deleting those routes would turn every one of them
// into a redirect-to-overview or a 404 — so they forward into the
// matching tab instead.
//
//   /command-center  ->  /leadership?tab=overview
//   /settings        ->  /leadership?tab=governance   (Chama only)
//
// The `children` escape hatch matters for /settings specifically:
// Contribution Groups share that route but have no Leadership Desk, so
// they keep rendering the standalone settings page. Redirecting them
// would send organizers to a page they have no permission to open.
//
// ========================================

export default function LegacyLeadershipRedirect({ tab = "overview", children = null }) {
  const { workspaceId } = useParams();
  const { workspaces, activeWorkspace, loading } = useWorkspace();

  if (loading) {
    return <Spinner fullscreen />;
  }

  const matchesId = (candidate) =>
    String(candidate?.id ?? candidate?._id) === String(workspaceId);

  const workspace =
    workspaces.find(matchesId) ||
    (activeWorkspace && matchesId(activeWorkspace) ? activeWorkspace : null);

  const belongsInDesk = workspace
    ? canViewLeadershipDesk(workspace.role, workspace.type)
    : false;

  if (belongsInDesk) {
    return (
      <Navigate to={`/workspace/${workspaceId}/leadership?tab=${tab}`} replace />
    );
  }

  // Not a Chama leader. Either render the original page (Contribution
  // Group settings) or, where there's nothing to fall back to, return
  // the person to their workspace overview.
  return children || <Navigate to={`/workspace/${workspaceId}`} replace />;
}
