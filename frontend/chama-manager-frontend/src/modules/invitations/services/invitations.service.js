import invitationsApi from "../api/invitations.api";

const invitationsService = {
  async list(status = "pending") {
    const { data } = await invitationsApi.list(status);
    return data.data.invitations || [];
  },

  async accept(invitationId) {
    const { data } = await invitationsApi.accept(invitationId);
    return data.data;
  },

  // payload: { userId, message?, expiresAt? } — userId is the RAW
  // Mongo _id of the person being invited. See the CHANGES doc: this
  // backend has no phone/email lookup endpoint, so the inviter must
  // already know the target's database id.
  async send(groupId, payload) {
    const { data } = await invitationsApi.send(groupId, payload);
    return data.data.invitation;
  },
};

export default invitationsService;