import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CornerDownLeft, CornerUpLeft, Search } from "lucide-react";
import clsx from "clsx";

/**
 * ⌘K / Ctrl+K jump-to for the admin console. Lists only the pages this
 * admin can open (it receives the same permission-filtered items as the
 * sidebar), plus the way back to the member app.
 */
export default function AdminCommandPalette({ open, onClose, items }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const entries = useMemo(
    () => [
      ...items.map((item) => ({ ...item, run: () => navigate(item.to) })),
      {
        to: "/home",
        label: "Exit to member app",
        icon: CornerUpLeft,
        group: "Account",
        keywords: "leave member home back",
        run: () => navigate("/home"),
      },
    ],
    [items, navigate]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) =>
      `${entry.label} ${entry.group} ${entry.keywords || ""}`.toLowerCase().includes(q)
    );
  }, [entries, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open) return null;

  const choose = (entry) => {
    if (!entry) return;
    onClose();
    entry.run();
  };

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[index]);
    } else if (event.key === "Escape") {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-950/60 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Jump to"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 dark:border-slate-800">
          <Search size={17} className="text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to a page…"
            className="h-12 w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
          />
          <kbd className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 dark:border-slate-700">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-500">Nothing matches “{query}”.</p>
          ) : (
            results.map((entry, i) => {
              const Icon = entry.icon;
              const active = i === index;
              return (
                <button
                  key={entry.to + entry.label}
                  type="button"
                  data-active={active}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => choose(entry)}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition",
                    active
                      ? "bg-violet-500/10 text-violet-700 dark:text-violet-200"
                      : "text-slate-700 dark:text-slate-300"
                  )}
                >
                  <Icon size={16} className={active ? "text-violet-500" : "text-slate-400"} />
                  <span className="font-medium">{entry.label}</span>
                  <span className="ml-auto text-[11px] text-slate-400">{entry.group}</span>
                  {active && <CornerDownLeft size={13} className="text-violet-400" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
