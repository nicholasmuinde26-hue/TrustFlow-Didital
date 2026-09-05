import { Pin, Trash2, Check, X, Clock } from "lucide-react";

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
  canApprove = false,
  onTogglePin,
  onDelete,
  onApprove,
  onReject,
}) {
  const { title, content, author, createdAt, pinned, status, rejectionReason } =
    announcement;
  const isPending = status === "pending";
  const isRejected = status === "rejected";
  const showActions = canPin || canDelete || (canApprove && isPending);

  return (
    <div
      className={`
        rounded-2xl border p-5
        ${
          isPending
            ? "border-amber-300/60 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"
            : isRejected
            ? "border-red-300/60 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10"
            : pinned
            ? "border-primary/30 bg-primary/5"
            : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
        }
      `}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {pinned && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                <Pin size={12} />
                Pinned
              </span>
            )}

            {isPending && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                <Clock size={12} />
                Awaiting approval
              </span>
            )}

            {isRejected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-600 dark:bg-red-500/20 dark:text-red-400">
                <X size={12} />
                Rejected
              </span>
            )}
          </div>

          <h3 className="font-semibold text-slate-900 dark:text-white">
            {title}
          </h3>

          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {content}
          </p>

          {isRejected && rejectionReason && (
            <p className="mt-2 text-xs text-red-500">
              Reason: {rejectionReason}
            </p>
          )}

          <p className="mt-3 text-xs text-slate-400">
            {author?.name || "Organizer"} · {formatDate(createdAt)}
          </p>
        </div>

        {showActions && (
          <div className="flex shrink-0 items-center gap-1">
            {canApprove && isPending && (
              <>
                <button
                  onClick={() => onApprove(announcement)}
                  title="Approve"
                  className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/30"
                >
                  <Check size={16} />
                </button>

                <button
                  onClick={() => onReject(announcement)}
                  title="Reject"
                  className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
                >
                  <X size={16} />
                </button>
              </>
            )}

            {canPin && !isPending && !isRejected && (
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