import api from "@/app/services/api";

// Membership, not identity — this is the ChamaMembership /
// ContributionGroupMember relationship from the backend, scoped to one
// workspace. Same endpoints regardless of workspace type.
const membersApi = {
  list(workspaceId) {
    return api.get(`/workspaces/${workspaceId}/members`);
  },

  invite(workspaceId, payload) {
    return api.post(`/workspaces/${workspaceId}/members/invite`, payload);
  },

  updateRole(workspaceId, memberId, role) {
    return api.patch(
      `/workspaces/${workspaceId}/members/${memberId}`,
      { role }
    );
  },

  remove(workspaceId, memberId) {
    return api.delete(`/workspaces/${workspaceId}/members/${memberId}`);
  },
};

export default membersApi;