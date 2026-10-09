import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";

// Ctrl/⌘ + K opens a search over every desk section the leader can reach.
// Roles and switched-off modules are already filtered out by the caller, so
// the palette can never offer a page the leader isn't allowed to open.
export default function CommandPalette({ open, onClose, items, onPick }) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      `${item.label} ${item.group} ${item.keywords || ""} ${item.detail || ""}`.toLowerCase().includes(needle)
    );
  }, [items, query]);

  useEffect(() => setCursor(0), [query]);

  if (!open) return null;

  const choose = (item) => {
    if (!item) return;
    onPick(item);
    onClose();
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") onClose();
    else if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((value) => Math.min(value + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((value) => Math.max(value - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[cursor]);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-slate-950/50" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Find a desk section" className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-obsidian-border dark:bg-obsidian-card">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 dark:border-obsidian-border">
          <Search size={16} className="text-slate-400" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Where do you want to go? Try “loans” or “paybill”"
            aria-label="Search the desk"
            className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-slate-400 dark:text-white"
          />
          <kbd className="hidden rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 sm:block dark:border-slate-700">Esc</kbd>
        </div>

        <ul role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-slate-500">Nothing on the desk matches “{query}”.</li>
          )}
          {results.map((item, index) => {
            const Icon = item.icon;
            const active = index === cursor;
            return (
              <li key={item.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => choose(item)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    active ? "bg-slate-100 dark:bg-obsidian-raised" : ""
                  }`}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 dark:bg-obsidian-raised dark:text-slate-300">
                    {Icon && <Icon size={15} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{item.label}</span>
                    <span className="block truncate text-xs text-slate-500">{item.detail || item.group}</span>
                  </span>
                  {item.badge ? (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                      {item.badge}
                    </span>
                  ) : null}
                  {active && <CornerDownLeft size={14} className="text-slate-400" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
