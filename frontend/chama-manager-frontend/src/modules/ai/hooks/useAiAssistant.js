import { useCallback, useEffect, useRef, useState } from "react";
import aiService from "../services/ai.service";

/**
 * Drives the collapsible AI assistant panel for a single workspace:
 * fetches insights/suggestions on demand and keeps a local chat
 * transcript, all scoped to `workspaceId`.
 */
export default function useAiAssistant(workspaceId) {
  const [overview, setOverview] = useState({ insights: [], suggestions: [] });
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState(null);
  const [overviewLoaded, setOverviewLoaded] = useState(false);

  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);

  const loadedForWorkspace = useRef(null);

  // Reset chat + overview whenever the user switches workspaces.
  useEffect(() => {
    setMessages([]);
    setOverview({ insights: [], suggestions: [] });
    setOverviewLoaded(false);
    setOverviewError(null);
    loadedForWorkspace.current = null;
  }, [workspaceId]);

  const loadOverview = useCallback(
    async (force = false) => {
      if (!workspaceId) return;
      if (!force && loadedForWorkspace.current === workspaceId) return;

      setOverviewLoading(true);
      setOverviewError(null);
      try {
        const data = await aiService.getOverview(workspaceId);
        setOverview(data);
        loadedForWorkspace.current = workspaceId;
        setOverviewLoaded(true);
      } catch (err) {
        setOverviewError(
          err?.response?.data?.message || "Couldn't load insights right now."
        );
      } finally {
        setOverviewLoading(false);
      }
    },
    [workspaceId]
  );

  const sendMessage = useCallback(
    async (text) => {
      const trimmed = (text || "").trim();
      if (!trimmed || !workspaceId || sending) return;

      const userMessage = { role: "user", text: trimmed, id: `u-${Date.now()}` };
      setMessages((prev) => [...prev, userMessage]);
      setSending(true);

      try {
        const { reply } = await aiService.sendMessage(workspaceId, trimmed);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: reply || "Sorry, I didn't get a response.", id: `a-${Date.now()}` },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: err?.response?.data?.message || "Something went wrong reaching the assistant. Try again in a moment.",
            id: `a-err-${Date.now()}`,
            error: true,
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [workspaceId, sending]
  );

  return {
    overview,
    overviewLoading,
    overviewError,
    overviewLoaded,
    loadOverview,
    messages,
    sending,
    sendMessage,
  };
}
