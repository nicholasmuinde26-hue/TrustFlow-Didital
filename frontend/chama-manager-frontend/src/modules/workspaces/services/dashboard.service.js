import { fetchDashboard } from "../api/dashboard.api";

export async function getDashboard(workspaceId) {
  const response = await fetchDashboard(workspaceId);

  return response.data;
}