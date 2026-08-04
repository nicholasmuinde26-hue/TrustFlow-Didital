import { useState } from "react";
import { SendHorizontal } from "lucide-react";

export default function ChatComposer({ onSend, sending }) {
  const [content, setContent] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmed = content.trim();
    if (!trimmed) return;

    setContent("");
    await onSend({ content: trimmed });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSubmit(event);
          }
        }}
        placeholder="Write a message..."
        rows={1}
        className="
          flex-1 resize-none rounded-xl border border-slate-200 bg-white
          px-4 py-3 text-sm text-slate-900 outline-none transition-colors
          focus:border-primary
          dark:border-slate-700 dark:bg-slate-800 dark:text-white
        "
      />

      <button
        type="submit"
        disabled={sending || !content.trim()}
        className="
          flex h-11 w-11 items-center justify-center rounded-xl bg-primary
          text-white transition-opacity disabled:opacity-50
        "
      >
        <SendHorizontal size={18} />
      </button>
    </form>
  );
}