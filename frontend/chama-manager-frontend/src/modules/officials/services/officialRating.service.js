import officialRatingApi from "../api/officialRating.api";

const officialRatingService = {
  async list(chamaId) {
    const { data } = await officialRatingApi.list(chamaId);
    return data.data.officials || [];
  },

  async submitRating(chamaId, membershipId, payload) {
    const { data } = await officialRatingApi.submitRating(chamaId, membershipId, payload);
    return data.data.rating;
  },

  async getDetail(chamaId, membershipId) {
    const { data } = await officialRatingApi.getDetail(chamaId, membershipId);
    return data.data.ratings || [];
  },
};

export default officialRatingService;
