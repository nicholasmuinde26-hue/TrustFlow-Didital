import { CalendarClock, Link2, Trash2 } from "lucide-react";

function formatWhen(value) {
  if (!value) return "";

  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MeetingCard({ meeting, canManage, onDelete }) {
  const isPast = meeting.startsAt && new Date(meeting.startsAt) < new Date();

  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {meeting.title}
          </h3>

          {isPast && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800">
              Past
            </span>
          )}
        </div>

        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
          <CalendarClock size={14} />
          {formatWhen(meeting.startsAt)}
        </p>

        {meeting.link && (
          <a
            href={meeting.link}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <Link2 size={14} />
            Join meeting
          </a>
        )}
      </div>

      {canManage && (
        <button
          onClick={() => onDelete(meeting)}
          title="Cancel meeting"
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}