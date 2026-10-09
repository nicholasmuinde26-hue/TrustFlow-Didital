import { AlertTriangle, ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";

// ========================================
// LEADERSHIP DESK CHROME
// ========================================
//
// The two pieces that frame every page on the desk:
//
//   - DeskPageHeader: ONE header per page. It replaces the old stack of a
//     title band, a tinted "where you are" banner and a mobile bar that all
//     said the same thing. Breadcrumb, page name, one plain line of purpose,
//     and the two global actions (search, refresh).
//   - DeskFooter: previous / next page as quiet links, and the audit note.
//
// Both are presentational: the page passes everything in.
//
// ========================================

const iconButton =
  "grid h-10 w-10 place-items-center rounded-xl border border-slate-200/80 bg-white/90 text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60 dark:border-obsidian-border dark:bg-obsidian-card/90 dark:text-mist-muted dark:hover:bg-obsidian-raised";

export function DeskPageHeader({ group, tab, tone, onSearch, onRefresh, refreshing }) {
  const Icon = tab?.icon;

  return (
    <header className={`relative isolate flex flex-wrap items-center justify-between gap-x-6 gap-y-5 overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50/80 p-5 shadow-[0_16px_45px_-35px_rgba(15,23,42,0.45)] sm:p-6 dark:border-obsidian-border dark:from-obsidian-card dark:via-obsidian-card dark:to-obsidian-raised/50`}>
      <span className={`absolute -right-8 -top-16 -z-10 h-52 w-52 rounded-full opacity-[0.08] blur-3xl ${tone.bar}`} aria-hidden="true" />
      <div className="flex min-w-0 items-center gap-4">
        {Icon ? (
          <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ring-1 ring-inset ring-black/[0.04] ${tone.soft}`}>
            <Icon size={24} aria-hidden="true" />
          </span>
        ) : null}

        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-mist-muted">
            <span>Leadership Desk</span>
            {group?.label && group.label !== tab?.label ? (
              <>
                <ChevronRight size={12} aria-hidden="true" />
                <span className={tone.text}>{group.label}</span>
              </>
            ) : null}
          </nav>
          <h1 className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{tab?.label}</h1>
          {tab?.purpose ? <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-mist-muted">{tab.purpose}</p> : null}
        </div>
      </div>

      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
        <button
          type="button"
          onClick={onSearch}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200/80 bg-white/90 px-3.5 text-sm text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-obsidian-border dark:bg-obsidian-card/90 dark:text-mist-muted dark:hover:bg-obsidian-raised"
        >
          <Search size={15} aria-hidden="true" />
          <span className="hidden sm:inline">Find a section</span>
          <kbd className="hidden rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 md:inline dark:border-slate-700">Ctrl K</kbd>
          <span className="sr-only sm:hidden">Find a section</span>
        </button>
        <span className="mr-1 hidden items-center gap-1.5 text-[11px] font-semibold text-slate-400 sm:inline-flex" role="status" aria-live="polite">
          <span className={`h-1.5 w-1.5 rounded-full ${refreshing ? "animate-pulse bg-amber-400" : "bg-emerald-500"}`} />
          {refreshing ? "Updating" : "Live"}
        </span>
        <button type="button" onClick={onRefresh} disabled={refreshing} aria-label="Refresh the desk" title="Refresh" className={iconButton}>
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

export function DeskFooter({ prev, next, onSelect }) {
  return (
    <footer className="space-y-4 border-t border-slate-200/70 pt-6 dark:border-obsidian-border">
      {prev || next ? (
        <nav aria-label="Previous and next page" className="flex items-center justify-between gap-4 text-sm">
          {prev ? (
            <button
              type="button"
              onClick={() => onSelect(prev.id)}
              className="inline-flex min-w-0 items-center gap-1.5 rounded-lg py-1 pr-2 font-semibold text-slate-600 transition hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-mist-muted dark:hover:text-white"
            >
              <ChevronLeft size={16} className="shrink-0" aria-hidden="true" />
              <span className="truncate">{prev.label}</span>
            </button>
          ) : (
            <span />
          )}
          {next ? (
            <button
              type="button"
              onClick={() => onSelect(next.id)}
              className="inline-flex min-w-0 items-center gap-1.5 rounded-lg py-1 pl-2 font-semibold text-slate-600 transition hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-mist-muted dark:hover:text-white"
            >
              <span className="truncate">{next.label}</span>
              <ChevronRight size={16} className="shrink-0" aria-hidden="true" />
            </button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}

      <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
        <AlertTriangle size={12} aria-hidden="true" />
        Every action taken here is recorded in this Chama's audit trail.
      </p>
    </footer>
  );
}
