import api from "@/app/services/api";

// Two invitation sources feed the "My Invitations" page:
//
// Contribution groups — matches contributionGroup.routes.js:
//   GET   /contribution-groups/invitations?status=pending
//   PATCH /contribution-groups/invitations/:invitationId/accept
//   PATCH /contribution-groups/invitations/:invitationId/decline
//   POST  /contribution-groups/:groupId/invitations   (sending one —
//         used from the Members page for a group manager)
//
// Chamas — matches chamaInvitation.routes.js. A treasurer/chairperson
// inviting a specific phone number (Command Center "Invite New
// Members") creates a direct invitation here, delivered instantly via
// socket.io (see shared/lib/socket.js):
//   GET   /chama-invitations/mine/invitations?status=pending
//   PATCH /chama-invitations/:invitationId/respond   { action }
const invitationsApi = {
  list(status) {
    return api.get("/contribution-groups/invitations", {
      params: status ? { status } : undefined,
    });
  },

  accept(invitationId) {
    return api.patch(`/contribution-groups/invitations/${invitationId}/accept`);
  },

  decline(invitationId) {
    return api.patch(`/contribution-groups/invitations/${invitationId}/decline`);
  },

  send(groupId, payload) {
    return api.post(`/contribution-groups/${groupId}/invitations`, payload);
  },

  listChama(status) {
    return api.get("/chama-invitations/mine/invitations", {
      params: status ? { status } : undefined,
    });
  },

  respondChama(invitationId, action) {
    return api.patch(`/chama-invitations/${invitationId}/respond`, { action });
  },
};

export default invitationsApi;