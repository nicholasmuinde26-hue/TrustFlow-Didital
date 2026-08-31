import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";

const SUGGESTED_PROMPTS = [
  "What's our balance?",
  "Who's overdue?",
  "Give me insights",
  "When's the next meeting?",
];

export default function ChatTab({ messages, sending, onSend, workspaceName }) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const submit = (text) => {
    const value = (text ?? draft).trim();
    if (!value) return;
    onSend(value);
    setDraft("");
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-2 py-6 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white">
              <Sparkles size={18} />
            </span>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Ask me about {workspaceName || "this workspace"}'s balance, contributions, loans, or meetings.
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => submit(prompt)}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-400"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "rounded-br-sm bg-primary text-white"
                  : m.error
                    ? "rounded-bl-sm bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                    : "rounded-bl-sm bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-2.5 dark:bg-slate-800">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-center gap-2 border-t border-slate-200 p-3 dark:border-slate-800"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask something…"
          className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white transition disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send message"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
