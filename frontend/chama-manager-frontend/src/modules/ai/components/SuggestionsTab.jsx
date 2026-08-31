import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, ListChecks } from "lucide-react";
import Spinner from "@/shared/components/ui/Spinner";
import { PRIORITY_STYLES } from "./severity";

export default function SuggestionsTab({ suggestions, loading, error }) {
  const navigate = useNavigate();
  const { workspaceId } = useParams();

  if (loading && !suggestions.length) {
    return (
      <div className="flex flex-1 items-center justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
        {error}
      </div>
    );
  }

  if (!suggestions.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
        <ListChecks size={22} className="text-slate-300 dark:text-slate-600" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No action items right now — things look on track.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4 scrollbar-thin">
      {suggestions.map((s) => (
        <div
          key={s.id}
          className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{s.title}</p>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_STYLES[s.priority] || PRIORITY_STYLES.normal}`}>
              {s.priority}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{s.message}</p>
          {s.action?.route && workspaceId && (
            <button
              onClick={() => navigate(`/workspace/${workspaceId}/${s.action.route}`)}
              className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              {s.action.label || "Go"}
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
