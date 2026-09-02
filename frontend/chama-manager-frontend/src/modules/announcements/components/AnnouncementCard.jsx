import { Pin, Trash2 } from "lucide-react";

function formatDate(value) {
  if (!value) return "";

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AnnouncementCard({
  announcement,
  canPin = false,
  canDelete = false,
  onTogglePin,
  onDelete,
}) {
  const { title, content, author, createdAt, pinned } = announcement;
  const showActions = canPin || canDelete;

  return (
    <div
      className={`
        rounded-2xl border p-5
        ${
          pinned
            ? "border-primary/30 bg-primary/5"
            : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
        }
      `}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          {pinned && (
            <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <Pin size={12} />
              Pinned
            </span>
          )}

          <h3 className="font-semibold text-slate-900 dark:text-white">
            {title}
          </h3>

          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {content}
          </p>

          <p className="mt-3 text-xs text-slate-400">
            {author?.name || "Organizer"} · {formatDate(createdAt)}
          </p>
        </div>

        {showActions && (
          <div className="flex shrink-0 items-center gap-1">
            {canPin && (
              <button
                onClick={() => onTogglePin(announcement)}
                title={pinned ? "Unpin" : "Pin"}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary dark:hover:bg-slate-800"
              >
                <Pin size={16} />
              </button>
            )}

            {canDelete && (
              <button
                onClick={() => onDelete(announcement)}
                title="Delete"
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}