import { useQuery } from "@tanstack/react-query";

import { getWorkspaceDashboard } from "../services/workspaceDashboard.service";

export default function useWorkspaceDashboard(workspaceId) {
    return useQuery({
        queryKey: ["workspace-dashboard", workspaceId],
        queryFn: () =>
            getWorkspaceDashboard(workspaceId),

        enabled: !!workspaceId,
    });
}