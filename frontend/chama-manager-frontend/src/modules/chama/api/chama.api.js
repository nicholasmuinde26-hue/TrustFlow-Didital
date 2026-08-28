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
  getProfile(chamaId) { return api.get(`/chamas/${chamaId}/profile`); },
  saveProfile(chamaId, payload) { return api.put(`/chamas/${chamaId}/profile`, payload); },
  addGoal(chamaId, payload) { return api.post(`/chamas/${chamaId}/goals`, payload); },
  assignOfficial(chamaId, membershipId, role) { return api.put(`/chamas/${chamaId}/officials/${membershipId}`, { role }); },
  createInvitation(chamaId, payload) { return api.post(`/chamas/${chamaId}/invitations`, payload); },
  submitKyc(chamaId, payload) { return api.post(`/chamas/${chamaId}/kyc`, payload); },
  applyLoan(chamaId, payload) { return api.post(`/chamas/${chamaId}/loans`, payload); },
  approveLoan(chamaId, loanId) { return api.post(`/chamas/${chamaId}/loans/${loanId}/approve`); },
  disburseLoan(chamaId, loanId) { return api.post(`/chamas/${chamaId}/loans/${loanId}/disburse`); },
  createMeetingRecord(chamaId, payload) { return api.post(`/chamas/${chamaId}/meeting-records`, payload); },
  checkInMeeting(chamaId, meetingId) { return api.post(`/chamas/${chamaId}/meeting-records/${meetingId}/check-in`); },
  saveMeetingRecord(chamaId, meetingId, payload) { return api.put(`/chamas/${chamaId}/meeting-records/${meetingId}`, payload); },
  acceptInvitation(token) { return api.post(`/chama-invitations/${token}/accept`); },

  getMgr(chamaId) {
    return api.get(`/chamas/${chamaId}/mgr`);
  },

  saveMgrSettings(chamaId, payload) {
    return api.put(`/chamas/${chamaId}/mgr/settings`, payload);
  },

  recordMgrReminder(chamaId, payload) {
    return api.post(`/chamas/${chamaId}/mgr/reminders`, payload);
  },

  getMgrHistory(chamaId) {
    return api.get(`/chamas/${chamaId}/mgr/history`);
  },

  markMgrPaid(chamaId, obligationId, payload) {
    return api.post(`/chamas/${chamaId}/mgr/obligations/${obligationId}/mark-paid`, payload);
  },
};

export default chamaApi;
