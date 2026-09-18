import { useState } from "react";
import { Plus, Smile, SendHorizontal } from "lucide-react";

export default function ChatComposer({ onSend, sending }) {
  const [content, setContent] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmed = content.trim();
    if (!trimmed) return;

    setContent("");
    await onSend({ message: trimmed });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-3 border-t px-5 py-4"
      style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "#0b1512" }}
    >
      <button
        type="button"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:text-white"
        style={{ backgroundColor: "#16211e" }}
        aria-label="Add attachment"
      >
        <Plus size={18} />
      </button>

      <div
        className="flex flex-1 items-center gap-2 rounded-2xl px-4 py-2.5"
        style={{ backgroundColor: "#131d1a" }}
      >
        <input
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSubmit(event);
            }
          }}
          placeholder="Write a message..."
          className="flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
        />
        <Smile size={18} className="shrink-0 text-slate-500" />
      </div>

      <button
        type="submit"
        disabled={sending || !content.trim()}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition disabled:opacity-50"
        style={{ backgroundColor: "#0f9d70" }}
      >
        <SendHorizontal size={17} />
      </button>
    </form>
  );
}