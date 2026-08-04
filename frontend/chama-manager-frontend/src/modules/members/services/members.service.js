import membersApi from "../api/members.api";

const membersService = {
  async list(workspaceId) {
    const { data } = await membersApi.list(workspaceId);
    return data.members || [];
  },

  async invite(workspaceId, payload) {
    const { data } = await membersApi.invite(workspaceId, payload);
    return data.member || data;
  },

  async updateRole(workspaceId, memberId, role) {
    const { data } = await membersApi.updateRole(workspaceId, memberId, role);
    return data.member || data;
  },

  async remove(workspaceId, memberId) {
    await membersApi.remove(workspaceId, memberId);
  },
};

export default membersService;