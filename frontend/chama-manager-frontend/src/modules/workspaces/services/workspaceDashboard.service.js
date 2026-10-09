import api from "@/app/services/api";

export async function getWorkspaceDashboard(workspaceId) {
    const { data } = await api.get(
        `/workspaces/${workspaceId}/dashboard`
    );

    return data.data;
}
