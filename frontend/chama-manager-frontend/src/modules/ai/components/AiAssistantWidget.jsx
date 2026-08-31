import { useEffect, useState } from "react";
import { MessageCircle, Lightbulb, ListChecks, X, Sparkles, RefreshCw } from "lucide-react";

import useAiAssistant from "../hooks/useAiAssistant";
import ChatTab from "./ChatTab";
import InsightsTab from "./InsightsTab";
import SuggestionsTab from "./SuggestionsTab";

const TABS = [
  { key: "chat", label: "Chat", icon: MessageCircle },
  { key: "insights", label: "Insights", icon: Lightbulb },
  { key: "suggestions", label: "Suggestions", icon: ListChecks },
];

const APPLICABLE_TYPES = new Set(["chama", "business", "contribution-group"]);

/**
 * Floating, collapsible AI assistant — positioned the same way across
 * every workspace type (chama, business, contribution group) so it
 * reads as one consistent feature rather than a per-module bolt-on.
 * Collapsed by default; expands into a small panel with Chat /
 * Insights / Suggestions tabs, all grounded in this workspace's real
 * data (see backend modules/ai — no third-party AI API involved).
 */
export default function AiAssistantWidget({ workspaceId, workspaceType, workspaceName }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("chat");

  const {
    overview,
    overviewLoading,
    overviewError,
    loadOverview,
    messages,
    sending,
    sendMessage,
  } = useAiAssistant(workspaceId);

  useEffect(() => {
    if (open && (tab === "insights" || tab === "suggestions")) {
      loadOverview();
    }
  }, [open, tab, loadOverview]);

  if (!workspaceId || !APPLICABLE_TYPES.has(workspaceType)) {
    return null;
  }

  const hasUrgent = overview.insights.some((i) => i.severity === "critical" || i.severity === "warning");

  return (
    <>
      {open && (
        <div
          className="fixed bottom-24 right-4 z-50 flex h-[70vh] max-h-[600px] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:right-6 sm:w-[380px]"
          role="dialog"
          aria-label="AI Assistant"
        >
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-3.5 text-white">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15">
                <Sparkles size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">AI Assistant</p>
                <p className="truncate text-[11px] leading-tight text-indigo-100">{workspaceName}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {(tab === "insights" || tab === "suggestions") && (
                <button
                  onClick={() => loadOverview(true)}
                  className="rounded-lg p-1.5 text-indigo-100 hover:bg-white/10"
                  aria-label="Refresh"
                >
                  <RefreshCw size={15} className={overviewLoading ? "animate-spin" : ""} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-indigo-100 hover:bg-white/10"
                aria-label="Collapse assistant"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-xs font-medium transition-colors ${
                  tab === key
                    ? "border-primary text-primary"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Body */}
          {tab === "chat" && (
            <ChatTab messages={messages} sending={sending} onSend={sendMessage} workspaceName={workspaceName} />
          )}
          {tab === "insights" && (
            <InsightsTab
              insights={overview.insights}
              loading={overviewLoading}
              error={overviewError}
              onRefresh={() => loadOverview(true)}
            />
          )}
          {tab === "suggestions" && (
            <SuggestionsTab suggestions={overview.suggestions} loading={overviewLoading} error={overviewError} />
          )}
        </div>
      )}

      {/* Launcher */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-600/30 transition-transform hover:scale-105 sm:right-6"
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
      >
        {open ? (
          <X size={22} />
        ) : (
          <>
            <Sparkles size={22} />
            {hasUrgent && (
              <span className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-white bg-amber-500 dark:border-slate-950" />
            )}
          </>
        )}
      </button>
    </>
  );
}
