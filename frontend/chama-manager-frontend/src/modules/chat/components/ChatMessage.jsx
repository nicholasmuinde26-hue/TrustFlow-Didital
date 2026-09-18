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

        <p
          className="mt-1 text-[11px]"
          style={{ color: isOwn ? "rgba(255,255,255,0.75)" : "#7d8b86" }}
        >
          {formatTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}