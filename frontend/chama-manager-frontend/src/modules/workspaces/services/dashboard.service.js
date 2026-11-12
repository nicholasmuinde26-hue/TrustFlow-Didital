import { fetchDashboard } from '../api/dashboard.api.js';

export async function getDashboard(workspaceId) {
  const response = await fetchDashboard(workspaceId);

  return response.data;
}
