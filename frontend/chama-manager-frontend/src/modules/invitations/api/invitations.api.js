import api from "@/app/services/api";

// Contribution groups only — Chama has no invitation model at all
// (see backend/src/models: there is no ChamaInvitation). Matches
// contributionGroup.routes.js exactly:
//
// GET   /contribution-groups/invitations?status=pending
// PATCH /contribution-groups/invitations/:invitationId/accept
// POST  /contribution-groups/:groupId/invitations   (sending one — used
//       from the Members page for a group manager, not from here)
const invitationsApi = {
  list(status) {
    return api.get("/contribution-groups/invitations", {
      params: status ? { status } : undefined,
    });
  },

  accept(invitationId) {
    return api.patch(`/contribution-groups/invitations/${invitationId}/accept`);
  },

  send(groupId, payload) {
    return api.post(`/contribution-groups/${groupId}/invitations`, payload);
  },
};

export default invitationsApi;