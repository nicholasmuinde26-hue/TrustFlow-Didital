import disputeApi from "../api/dispute.api";

export const DISPUTE_SUBJECT_TYPES = [
  { value: "loan", label: "A loan decision" },
  { value: "contribution", label: "A contribution" },
  { value: "withdrawal", label: "A withdrawal" },
  { value: "payout", label: "A payout" },
  { value: "official_conduct", label: "An official's conduct" },
  { value: "other", label: "Something else" },
];

const disputeService = {
  async list(chamaId, params) {
    const { data } = await disputeApi.list(chamaId, params);
    return {
      disputes: data.data.disputes || [],
      pagination: data.data.pagination,
    };
  },

  async raise(chamaId, { subjectType, subjectId, againstMembershipId, title, description }) {
    const { data } = await disputeApi.raise(chamaId, {
      subjectType,
      subjectId,
      againstMembershipId,
      title,
      description,
    });
    return data.data.dispute;
  },

  async updateStatus(chamaId, disputeId, { status, resolutionNotes }) {
    const { data } = await disputeApi.updateStatus(chamaId, disputeId, {
      status,
      resolutionNotes,
    });
    return data.data.dispute;
  },
};

export default disputeService;
