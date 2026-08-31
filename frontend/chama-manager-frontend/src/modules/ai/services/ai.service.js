import aiApi from "../api/ai.api";

const safeData = (res) => res?.data?.data ?? res?.data ?? {};

const aiService = {
  async getOverview(workspaceId) {
    const res = await aiApi.overview(workspaceId);
    const data = safeData(res);
    return {
      workspaceType: data.workspaceType || null,
      insights: data.insights || [],
      suggestions: data.suggestions || [],
    };
  },

  async sendMessage(workspaceId, message) {
    const res = await aiApi.chat(workspaceId, message);
    const data = safeData(res);
    return {
      reply: data.reply || "",
      intent: data.intent || null,
    };
  },
};

export default aiService;
