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
        className={`
          max-w-[75%] rounded-2xl px-4 py-2.5 text-sm
          ${
            isOwn
              ? "bg-primary text-white"
              : "bg-white text-slate-800 border border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
          }
        `}
      >
        {!isOwn && (
          <p className="mb-1 text-xs font-semibold text-primary">
            {author}
          </p>
        )}

        <p className="whitespace-pre-wrap break-words">
          {message.message}
        </p>

        <p
          className={`
            mt-1 text-[11px]
            ${isOwn ? "text-blue-100" : "text-slate-400"}
          `}
        >
          {formatTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}
