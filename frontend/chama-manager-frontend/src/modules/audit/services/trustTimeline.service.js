import trustTimelineApi from "../api/trustTimeline.api";

const trustTimelineService = {
  async list(chamaId, params) {
    const { data } = await trustTimelineApi.list(chamaId, params);
    return {
      events: data.data.events || [],
      pagination: data.data.pagination,
    };
  },

  // A broken chain is a successful response, not an error - the request
  // worked, the answer is just bad news. Only a genuine transport or
  // auth failure should reject here, so the UI can tell "we couldn't
  // check" apart from "we checked, and something is wrong".
  async verify(chamaId) {
    const { data } = await trustTimelineApi.verify(chamaId);
    const result = data.data || {};

    return {
      valid: Boolean(result.valid),
      totalEntries: result.totalEntries ?? 0,
      verifiedEntries: result.verifiedEntries ?? 0,
      expectedTotalEntries: result.expectedTotalEntries ?? 0,
      brokenAtSequence: result.brokenAtSequence ?? null,
      reason: result.reason ?? null,
      chainTip: result.chainTip ?? null,
      verifiedAt: result.verifiedAt ?? null,
    };
  },
};

export default trustTimelineService;