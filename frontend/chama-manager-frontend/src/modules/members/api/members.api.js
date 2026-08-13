import api from "@/app/services/api";

// Chama and Contribution Group members are genuinely different resources
// on the backend (different routes, different response shapes, different
// role vocabularies) — this dispatches by workspace type so the rest of
// the frontend (hooks/components/page) can stay uniform.
const membersApi = {
  list(type, workspaceId) {
    if (type === "chama") {
      return api.get(`/chamas/${workspaceId}/members`);
    }

    return api.get(`/contribution-groups/${workspaceId}/members`);
  },

  // Adds a member directly using their raw database user id. Both
  // backends require this exact field — there is no phone/email lookup
  // endpoint (see CHANGES doc), so the caller must already know it.
  add(type, workspaceId, payload) {
    if (type === "chama") {
      return api.post(`/chamas/${workspaceId}/members`, payload);
    }

    return api.post(`/contribution-groups/${workspaceId}/members`, payload);
  },

  updateRole(type, workspaceId, memberId, role) {
    if (type === "chama") {
      return api.patch(`/chamas/${workspaceId}/members/${memberId}/role`, { role });
    }

    return api.patch(
      `/contribution-groups/${workspaceId}/members/${memberId}/role`,
      { role }
    );
  },

  // Chama soft-removes via PATCH .../remove; Contribution Group actually
  // uses DELETE. This is the backend's own inconsistency, not a typo.
  remove(type, workspaceId, memberId) {
    if (type === "chama") {
      return api.patch(`/chamas/${workspaceId}/members/${memberId}/remove`);
    }

    return api.delete(`/contribution-groups/${workspaceId}/members/${memberId}`);
  },

  updateProfile(type, workspaceId, memberId, payload) {
    if (type === "chama") {
      return api.patch(
        `/chamas/${workspaceId}/members/${memberId}/profile`,
        payload
      );
    }

    throw new Error("Member profile updates are only supported for Chamas");
  },

  // Chama-only: Chama also supports suspending/reactivating a member and
  // transferring the Treasurer role. Contribution Groups have no
  // equivalent backend routes for either.
  updateStatus(type, workspaceId, memberId, status) {
    if (type === "chama") {
      return api.patch(`/chamas/${workspaceId}/members/${memberId}/status`, { status });
    }

    throw new Error("Member status updates are only supported for Chamas");
  },

  transferTreasurer(type, workspaceId, newTreasurerMemberId) {
    if (type === "chama") {
      return api.patch(`/chamas/${workspaceId}/members/transfer-treasurer`, {
        newTreasurerMemberId,
      });
    }

    throw new Error("Treasurer transfer is only supported for Chamas");
  },
};

export default membersApi;