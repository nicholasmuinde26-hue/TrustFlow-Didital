import { buildAiContext } from "./ai.context.service.js";
import { generateInsights } from "./insights.engine.js";
import { generateSuggestions } from "./suggestions.engine.js";
import { respond } from "./chatbot.engine.js";

class AiService {
  async getInsights({ workspaceId, userId }) {
    const ctx = await buildAiContext({ workspaceId, userId });
    return {
      workspaceType: ctx.workspaceType,
      insights: generateInsights(ctx),
    };
  }

  async getSuggestions({ workspaceId, userId }) {
    const ctx = await buildAiContext({ workspaceId, userId });
    return {
      workspaceType: ctx.workspaceType,
      suggestions: generateSuggestions(ctx),
    };
  }

  async getOverview({ workspaceId, userId }) {
    const ctx = await buildAiContext({ workspaceId, userId });
    return {
      workspaceType: ctx.workspaceType,
      insights: generateInsights(ctx),
      suggestions: generateSuggestions(ctx),
    };
  }

  async chat({ workspaceId, userId, message }) {
    const ctx = await buildAiContext({ workspaceId, userId });
    const result = respond(message, ctx);
    return {
      workspaceType: ctx.workspaceType,
      ...result,
    };
  }
}

export default new AiService();
