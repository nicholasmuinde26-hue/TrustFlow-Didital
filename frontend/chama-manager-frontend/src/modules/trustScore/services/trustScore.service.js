import trustScoreApi, { publicTrustScoreApi } from "../api/trustScore.api";

const trustScoreService = {
  async getLatest(chamaId) {
    const { data } = await trustScoreApi.getLatest(chamaId);
    return data.data.trustScore || null;
  },

  async getHistory(chamaId, params) {
    const { data } = await trustScoreApi.getHistory(chamaId, params);
    return {
      snapshots: data.data.snapshots || [],
      pagination: data.data.pagination,
    };
  },

  async generate(chamaId) {
    const { data } = await trustScoreApi.generate(chamaId);
    return data.data.trustScore;
  },

  async share(chamaId, trustScoreId) {
    const { data } = await trustScoreApi.share(chamaId, trustScoreId);
    return { trustScore: data.data.trustScore, shareUrl: data.data.shareUrl };
  },

  async revoke(chamaId, trustScoreId) {
    const { data } = await trustScoreApi.revoke(chamaId, trustScoreId);
    return data.data.trustScore;
  },

  async getPublicReport(token) {
    const { data } = await publicTrustScoreApi.getByToken(token);
    return data.data.report;
  },
};

export default trustScoreService;
