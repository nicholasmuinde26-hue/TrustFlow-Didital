import { RefreshCw, Sparkles } from "lucide-react";
import Spinner from "@/shared/components/ui/Spinner";
import { SEVERITY_STYLES } from "./severity";

export default function InsightsTab({ insights, loading, error, onRefresh }) {
  if (loading && !insights.length) {
    return (
      <div className="flex flex-1 items-center justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <RefreshCw size={13} />
          Try again
        </button>
      </div>
    );
  }

  if (!insights.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
        <Sparkles size={22} className="text-slate-300 dark:text-slate-600" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nothing notable to flag right now.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4 scrollbar-thin">
      {insights.map((insight) => {
        const style = SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.info;
        const Icon = style.icon;
        return (
          <div
            key={insight.id}
            className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start gap-2.5">
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${style.badge}`}>
                <Icon size={13} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {insight.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {insight.message}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
