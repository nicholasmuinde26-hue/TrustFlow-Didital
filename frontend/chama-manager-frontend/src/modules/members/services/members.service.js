import membersApi from "../api/members.api";

// Normalizes the two backends' differently-shaped responses into one
// consistent shape so hooks/components never branch on type themselves.
const membersService = {
  async list(type, workspaceId) {
    const { data } = await membersApi.list(type, workspaceId);
    return data.data.members || [];
  },

  async add(type, workspaceId, payload) {
    // Accepts either an object ({ phone, name } or { userId }) or a legacy string userId
    const requestPayload = typeof payload === "string" ? { userId: payload } : payload;
    const { data } = await membersApi.add(type, workspaceId, requestPayload);
    
    // Chama wraps the created membership as { member }, Contribution
    // Group as { membership } — same document, different key.
    return data.data.member || data.data.membership;
  },

  async updateRole(type, workspaceId, memberId, role) {
    const { data } = await membersApi.updateRole(type, workspaceId, memberId, role);
    return data.data.member || data.data.membership;
  },

  async remove(type, workspaceId, memberId) {
    const { data } = await membersApi.remove(type, workspaceId, memberId);
    return data.data.member || data.data.membership;
  },

  async updateProfile(type, workspaceId, memberId, payload) {
    const { data } = await membersApi.updateProfile(
      type,
      workspaceId,
      memberId,
      payload
    );
    return data.data.member || data.data.membership;
  },

  async updateStatus(type, workspaceId, memberId, status) {
    const { data } = await membersApi.updateStatus(type, workspaceId, memberId, status);
    return data.data.member || data.data.membership;
  },

  async transferTreasurer(type, workspaceId, newTreasurerMemberId) {
    const { data } = await membersApi.transferTreasurer(type, workspaceId, newTreasurerMemberId);
    return data.data;
  },
};

export default membersService;