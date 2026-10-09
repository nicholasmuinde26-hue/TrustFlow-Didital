import withdrawalApi from '../api/withdrawal.api';

const data = async (request) => (await request).data.data;

const withdrawalService = {
  // Officer/review-queue view — everyone's requests for the chama,
  // optionally narrowed by status or memberId.
  list: async (chamaId, params) => (await data(withdrawalApi.list(chamaId, params))).withdrawals || [],

  // Member view — the caller's own requests only.
  mine: async (chamaId, params) => (await data(withdrawalApi.mine(chamaId, params))).withdrawals || [],

  get: (chamaId, withdrawalId) => data(withdrawalApi.get(chamaId, withdrawalId)).then((d) => d.withdrawal),

  request: (chamaId, payload) => data(withdrawalApi.request(chamaId, payload)),

  decide: (chamaId, withdrawalId, decision, comment) =>
    data(withdrawalApi.decide(chamaId, withdrawalId, decision, comment)).then((d) => d.withdrawal),

  settle: (chamaId, withdrawalId, disbursementMethod, externalReference) =>
    data(withdrawalApi.settle(chamaId, withdrawalId, disbursementMethod, externalReference)).then((d) => d.withdrawal),

  cancel: (chamaId, withdrawalId, reason) =>
    data(withdrawalApi.cancel(chamaId, withdrawalId, reason)).then((d) => d.withdrawal),

  getPolicies: async (chamaId) => (await data(withdrawalApi.policies(chamaId))).policies || [],
};

export default withdrawalService;