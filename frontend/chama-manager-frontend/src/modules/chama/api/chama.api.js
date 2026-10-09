import api from "@/app/services/api";

const chamaApi = {
  create(payload) {
    return api.post("/chamas", payload);
  },

  verifyTreasurer(query) {
    return api.get("/chamas/verify-treasurer", { params: { query } });
  },

  get(chamaId) {
    return api.get(`/chamas/${chamaId}`);
  },

  getPublicChamas() {
    return api.get('/chamas/directory/public');
  },

  joinWithCode(joinCode) {
    return api.post('/chamas/directory/join', { joinCode });
  },

  // One-click "Request to Join" from the public directory — no code
  // needed, since the Chama is already publicly visible.
  requestToJoinPublicChama(chamaId) {
    return api.post(`/chamas/directory/${chamaId}/join`);
  },

  update(chamaId, payload) {
    return api.patch(`/chamas/${chamaId}`, payload);
  },

  remove(chamaId) {
    return api.delete(`/chamas/${chamaId}`);
  },

  depositSavings(chamaId, payload, idempotencyKey) {
    return api.post(`/chamas/${chamaId}/savings/deposit`, payload, {
      headers: { "Idempotency-Key": idempotencyKey },
    });
  },

  getPaymentIntent(chamaId, paymentIntentId) {
    return api.get(`/chamas/${chamaId}/payment-intents/${paymentIntentId}`);
  },
  reconcilePaymentIntent(chamaId, paymentIntentId) {
    return api.post(`/chamas/${chamaId}/payment-intents/${paymentIntentId}/reconcile`);
  },
  getCommandCenter(chamaId) { return api.get(`/chamas/${chamaId}/command-center`); },
  getPublicProfile(chamaId) { return api.get(`/chamas/${chamaId}/public-profile`); },
  // A person's card (member or official), shown when someone taps their profile.
  getPersonProfile(chamaId, membershipId) { return api.get(`/chamas/${chamaId}/public-profile/people/${membershipId}`); },
  personImageUrl(chamaId, membershipId) { return `${api.defaults.baseURL}/chamas/${chamaId}/public-profile/people/${membershipId}/image`; },
  getMyPublicProfile(chamaId) { return api.get(`/chamas/${chamaId}/my-public-profile`); },
  saveMyPublicProfile(chamaId, payload) { return api.put(`/chamas/${chamaId}/my-public-profile`, payload); },
  // The Chama's own public details + logo/cover (no payment PIN needed).
  getPublicSettings(chamaId) { return api.get(`/chamas/${chamaId}/public-settings`); },
  savePublicProfile(chamaId, payload) { return api.put(`/chamas/${chamaId}/public-profile`, payload); },
  // Reviewers load one person's ID photo + selfie on demand.
  getKycDocuments(chamaId, membershipId) { return api.get(`/chamas/${chamaId}/kyc/${membershipId}/documents`); },
  // Chama (organisation) KYC.
  getOrgKyc(chamaId) { return api.get(`/chamas/${chamaId}/org-kyc`); },
  submitOrgKyc(chamaId, payload) { return api.post(`/chamas/${chamaId}/org-kyc`, payload); },
  getProfile(chamaId) { return api.get(`/chamas/${chamaId}/profile`); },
  saveProfile(chamaId, payload) { return api.put(`/chamas/${chamaId}/profile`, payload); },
  addGoal(chamaId, payload) { return api.post(`/chamas/${chamaId}/goals`, payload); },
  assignOfficial(chamaId, membershipId, role) { return api.put(`/chamas/${chamaId}/officials/${membershipId}`, { role }); },
  createInvitation(chamaId, payload) { return api.post(`/chamas/${chamaId}/invitations`, payload); },
  submitKyc(chamaId, payload) { return api.post(`/chamas/${chamaId}/kyc`, payload); },

  // Leadership-side counterpart to submitKyc: an official approving or
  // rejecting another member's submitted ID. Gated by the leadership
  // session on the backend (chamaOperations.routes.js).
  verifyKyc(chamaId, membershipId, status, reason) {
    return api.put(`/chamas/${chamaId}/kyc/${membershipId}`, { status, reason });
  },
  applyLoan(chamaId, payload) { return api.post(`/chamas/${chamaId}/loans`, payload); },
  approveLoan(chamaId, loanId) { return api.post(`/chamas/${chamaId}/loans/${loanId}/approve`); },
  disburseLoan(chamaId, loanId) { return api.post(`/chamas/${chamaId}/loans/${loanId}/disburse`); },
  createMeetingRecord(chamaId, payload) { return api.post(`/chamas/${chamaId}/meeting-records`, payload); },
  checkInMeeting(chamaId, meetingId) { return api.post(`/chamas/${chamaId}/meeting-records/${meetingId}/check-in`); },
  saveMeetingRecord(chamaId, meetingId, payload) { return api.put(`/chamas/${chamaId}/meeting-records/${meetingId}`, payload); },

  // Public — safe to call before the user is authenticated, mirrors the
  // accept endpoint below (same /chama-invitations/:token resource).
  previewInvitation(token) { return api.get(`/chama-invitations/${token}`); },
  acceptInvitation(token) { return api.post(`/chama-invitations/${token}/accept`); },
  myPendingRequests() { return api.get('/chama-invitations/mine/pending'); },

  // Pending "request to join" entries are ChamaMembership records with
  // status "pending" — this dedicated, treasurer/chairperson-only route
  // is the correct source (the general members list at GET
  // /chamas/:id/members hardcodes status: "active" and will never
  // include these).
  listJoinRequests(chamaId) { return api.get(`/chamas/${chamaId}/members/join-requests`); },

  listMembers(chamaId) {
    return api.get(`/chamas/${chamaId}/members`);
  },

  // NOTE: MGR (Merry-Go-Round) is NOT a sub-resource of /chamas/:id — it's
  // its own governed module mounted at /api/v1/mgr (policies, rounds,
  // approvals). None of the /chamas/:id/mgr/* routes this object used to
  // define exist on the backend (see backend/src/modules/mgr/mgr.routes.js
  // and mgr.controller.js). Use `mgrApi` from "./mgr.api" instead — its
  // getOverview/createPolicy/activatePolicy/recordPayment/proposePayout/
  // disbursePayout/reorderRotation calls are what's actually mounted.
};

export default chamaApi;
