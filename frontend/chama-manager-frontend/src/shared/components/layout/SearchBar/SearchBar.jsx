import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import CommandPalette from "../CommandPalette/CommandPalette";

/**
 * Top-bar search. It used to be a text box that did nothing; it now opens
 * the command palette, so it actually takes people where they want to go.
 * Ctrl/Cmd + K works from anywhere in the workspace.
 */
export default function SearchBar() {
  const [open, setOpen] = useState(false);

  const isMac =
    typeof navigator !== "undefined" && /mac/i.test(navigator.platform || "");

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Jump to a page or workspace"
        className="hidden h-11 w-72 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 text-left transition hover:border-slate-300 hover:bg-white focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 md:flex xl:w-80 dark:border-obsidian-border dark:bg-obsidian-raised dark:hover:bg-slate-900"
      >
        <Search size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
        <span className="flex-1 truncate text-sm text-slate-400 dark:text-slate-500">
          Jump to a page or workspace
        </span>
        <kbd className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-500 dark:border-obsidian-border dark:bg-obsidian dark:text-mist-muted">
          {isMac ? "⌘" : "Ctrl"} K
        </kbd>
      </button>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Jump to a page or workspace"
        className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 md:hidden dark:text-mist-muted dark:hover:bg-obsidian-card"
      >
        <Search size={18} aria-hidden="true" />
      </button>

      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </>
  );
}
