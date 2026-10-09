function formatTime(value) {
  if (!value) return "";

  return new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ChatMessage({ message, isOwn }) {
  const author = message.sender?.name || "Member";

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
          isOwn ? "text-white" : "border border-white/5 text-slate-100"
        }`}
        style={isOwn ? { backgroundColor: "#0f9d70" } : { backgroundColor: "#16211e" }}
      >
        {!isOwn && (
          <p className="mb-1 text-xs font-semibold" style={{ color: "#5eead4" }}>
            {author}
          </p>
        )}

        <p className="whitespace-pre-wrap break-words">
          {message.message}
        </p>

        {message.attachments?.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.attachments.map((attachment, index) => attachment.mimeType?.startsWith("image/") ? (
              <a key={`${attachment.filename}-${index}`} href={attachment.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl">
                <img src={attachment.url} alt={attachment.filename || "Shared image"} className="max-h-64 max-w-full object-contain" loading="lazy" />
              </a>
            ) : (
              <a key={`${attachment.filename}-${index}`} href={attachment.url} download={attachment.filename} className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-emerald-100 hover:bg-white/5">
                <span aria-hidden="true">📎</span><span className="max-w-48 truncate">{attachment.filename || "Download attachment"}</span>
              </a>
            ))}
          </div>
        )}

        <p
          className="mt-1 text-[11px]"
          style={{ color: isOwn ? "rgba(255,255,255,0.75)" : "#7d8b86" }}
        >
          {message.pending ? "Sending…" : formatTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}
