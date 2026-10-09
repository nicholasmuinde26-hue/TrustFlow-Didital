import { useRef, useState } from "react";
import { File, ImagePlus, Paperclip, SendHorizontal, Smile, X } from "lucide-react";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_FILE_SIZE = 1.5 * 1024 * 1024;
const MAX_ATTACHMENTS = 2;
const QUICK_EMOJIS = ["😀", "😊", "❤️", "👍", "🙏", "🎉", "😂", "✨"];

function formatFileSize(size) {
  return size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ChatComposer({ onSend, sending }) {
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [showEmojis, setShowEmojis] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const canSend = Boolean(content.trim() || attachments.length) && !sending;

  function insertEmoji(emoji) {
    const input = inputRef.current;
    const start = input?.selectionStart ?? content.length;
    const end = input?.selectionEnd ?? content.length;
    const next = `${content.slice(0, start)}${emoji}${content.slice(end)}`;
    setContent(next);
    setShowEmojis(false);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  async function addFiles(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    setError("");
    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      setError(`Attach up to ${MAX_ATTACHMENTS} files per message.`);
      return;
    }

    const remainingBytes = MAX_ATTACHMENTS * MAX_FILE_SIZE - attachments.reduce((sum, file) => sum + file.size, 0);
    if (files.some((file) => file.size > MAX_FILE_SIZE)) {
      setError("Each attachment must be 1.5 MB or smaller.");
      return;
    }
    const allowedTypes = new Set([
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "application/pdf", "text/plain", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]);
    if (files.some((file) => !allowedTypes.has(file.type))) {
      setError("Choose an image, PDF, Word, Excel, or text file.");
      return;
    }
    if (files.reduce((sum, file) => sum + file.size, 0) > remainingBytes) {
      setError("The combined attachment size is too large.");
      return;
    }

    try {
      const encoded = await Promise.all(files.map((file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
          url: reader.result,
          filename: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
        });
        reader.onerror = () => reject(new Error(`Couldn't read ${file.name}.`));
        reader.readAsDataURL(file);
      })));
      setAttachments((current) => [...current, ...encoded]);
    } catch (readError) {
      setError(readError.message || "Couldn't read that attachment.");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSend) return;

    const payload = { message: content.trim(), attachments };
    setError("");
    try {
      await onSend(payload);
      setContent("");
      setAttachments([]);
      if (inputRef.current) inputRef.current.style.height = "24px";
    } catch (sendError) {
      setError(sendError?.response?.data?.message || "Message couldn't be sent. Try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative border-t px-3 py-3 sm:px-5 sm:py-4" style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "#0b1512" }}>
      {showEmojis && (
        <div className="absolute bottom-full left-4 z-20 mb-3 flex items-center gap-1 rounded-2xl border border-white/10 p-2 shadow-2xl" style={{ backgroundColor: "#17231f" }}>
          {QUICK_EMOJIS.map((emoji) => (
            <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} className="flex h-9 w-9 items-center justify-center rounded-xl text-xl transition hover:bg-white/10" aria-label={`Insert ${emoji}`}>
              {emoji}
            </button>
          ))}
        </div>
      )}

      <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/gif,image/webp,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={addFiles} className="hidden" aria-label="Choose chat attachments" />

      <div className="rounded-3xl border border-white/[0.08] px-3 py-2 shadow-lg sm:px-4" style={{ backgroundColor: "#111c18" }}>
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 border-b border-white/[0.07] pb-2">
            {attachments.map((attachment, index) => (
              <div key={`${attachment.filename}-${index}`} className="flex max-w-full items-center gap-2 rounded-xl border border-white/10 px-2.5 py-2 text-xs text-slate-300" style={{ backgroundColor: "#182520" }}>
                {attachment.mimeType.startsWith("image/") ? <ImagePlus size={15} className="shrink-0 text-emerald-300" /> : <File size={15} className="shrink-0 text-emerald-300" />}
                <span className="max-w-40 truncate">{attachment.filename}</span>
                <span className="shrink-0 text-slate-500">{formatFileSize(attachment.size)}</span>
                <button type="button" onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded p-0.5 text-slate-500 hover:text-white" aria-label={`Remove ${attachment.filename}`}><X size={14} /></button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 sm:gap-3">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={sending || attachments.length >= MAX_ATTACHMENTS} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/[0.07] hover:text-emerald-200 disabled:opacity-40" aria-label="Attach a file" title="Attach an image or document">
            <Paperclip size={19} />
          </button>

          <textarea
            ref={inputRef}
            value={content}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={1}
            onChange={(event) => {
              setContent(event.target.value);
              event.target.style.height = "24px";
              event.target.style.height = `${Math.min(event.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSubmit(event);
              }
            }}
            placeholder="Write a message..."
            aria-label="Write a message"
            className="max-h-[120px] min-h-10 flex-1 resize-none bg-transparent px-1 py-2.5 text-sm leading-5 text-slate-100 outline-none placeholder:text-slate-500 sm:text-[15px]"
          />

          <button type="button" onClick={() => setShowEmojis((open) => !open)} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition hover:bg-white/[0.07] ${showEmojis ? "text-emerald-200" : "text-slate-400 hover:text-white"}`} aria-label="Choose an emoji" aria-expanded={showEmojis}>
            <Smile size={19} />
          </button>

          <button type="submit" disabled={!canSend} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-md transition enabled:hover:scale-105 enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:h-11 sm:w-11" style={{ backgroundColor: "#0f9d70" }} aria-label={sending ? "Sending message" : "Send message"} title="Send message">
            <SendHorizontal size={18} />
          </button>
        </div>
      </div>

      <div className="flex min-h-5 items-center justify-between px-3 pt-1.5 text-[11px] text-slate-500">
        <span className={error ? "text-rose-300" : ""}>{error || (sending ? "Sending…" : "Enter to send · Shift + Enter for a new line")}</span>
        {content.length > 0 && <span>{content.length}/{MAX_MESSAGE_LENGTH}</span>}
      </div>
    </form>
  );
}
