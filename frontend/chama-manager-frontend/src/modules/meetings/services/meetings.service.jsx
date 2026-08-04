import meetingsApi from "../api/meetings.api";

const meetingsService = {
  async list(workspaceId) {
    const { data } = await meetingsApi.list(workspaceId);
    return data.meetings || [];
  },

  async create(workspaceId, payload) {
    const { data } = await meetingsApi.create(workspaceId, payload);
    return data.meeting || data;
  },

  async remove(workspaceId, meetingId) {
    await meetingsApi.remove(workspaceId, meetingId);
  },
};

export default meetingsService;