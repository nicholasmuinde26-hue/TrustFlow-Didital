import api from "@/app/services/api";

// Chama and Contribution Group members are genuinely different resources
// on the backend (different routes, different response shapes, different
// role vocabularies) — this dispatches by workspace type so the rest of
// the frontend (hooks/components/page) can stay uniform.
//
// Burial Chamas are Chama documents underneath (same ChamaMembership
// model, same routes), so they're treated identically to "chama" here.
const isChamaType = (type) => type === "chama" || type === "burial-chama";

const membersApi = {
  list(type, workspaceId) {
    if (isChamaType(type)) {
      return api.get(`/chamas/${workspaceId}/members`);
    }

    return api.get(`/contribution-groups/${workspaceId}/members`);
  },

  // Adds a member directly using their raw database user id. Both
  // backends require this exact field — there is no phone/email lookup
  // endpoint (see CHANGES doc), so the caller must already know it.
  add(type, workspaceId, payload) {
    if (isChamaType(type)) {
      return api.post(`/chamas/${workspaceId}/members`, payload);
    }

    return api.post(`/contribution-groups/${workspaceId}/members`, payload);
  },

  updateRole(type, workspaceId, memberId, role) {
    if (isChamaType(type)) {
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
    if (isChamaType(type)) {
      return api.patch(`/chamas/${workspaceId}/members/${memberId}/remove`);
    }

    return api.delete(`/contribution-groups/${workspaceId}/members/${memberId}`);
  },

  updateProfile(type, workspaceId, memberId, payload) {
    if (isChamaType(type)) {
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
    if (isChamaType(type)) {
      return api.patch(`/chamas/${workspaceId}/members/${memberId}/status`, { status });
    }

    throw new Error("Member status updates are only supported for Chamas");
  },

  transferTreasurer(type, workspaceId, newTreasurerMemberId) {
    if (isChamaType(type)) {
      return api.patch(`/chamas/${workspaceId}/members/transfer-treasurer`, {
        newTreasurerMemberId,
      });
    }

    throw new Error("Treasurer transfer is only supported for Chamas");
  },

  // Chama-only: arranges the Merry-Go-Round rotation — who receives the
  // payout, and in what order. `order` is the full list of active
  // ChamaMembership IDs, first payout to last. No Contribution Group
  // equivalent exists on the backend.
  reorderPayoutPositions(type, workspaceId, order) {
    if (isChamaType(type)) {
      return api.patch(`/chamas/${workspaceId}/members/payout-order`, {
        order,
      });
    }

    throw new Error("Payout order is only supported for Chamas");
  },
};

export default membersApi;