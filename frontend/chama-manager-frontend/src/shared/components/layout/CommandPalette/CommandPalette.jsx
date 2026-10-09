import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Bell,
  Clock,
  CornerDownLeft,
  Home,
  Layers,
  Search,
  Settings,
} from "lucide-react";

import useWorkspace from "@/app/hooks/useWorkspace";
import { getWorkspaceNavigation, getLeadershipDeskItem } from "@/modules/workspaces/config/workspaceNavigation";

/**
 * Jump-to palette (Ctrl/Cmd + K).
 *
 * Lists every page the person can open in the current workspace (already
 * filtered by their role, because it uses the same navigation config as
 * the sidebar), plus their other workspaces and a few account shortcuts.
 * Recently opened destinations appear first when the box is empty.
 */

const RECENT_KEY = "cm:recent-destinations";
const MAX_RECENT = 4;

function readRecent() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecent(entry) {
  try {
    const next = [
      entry,
      ...readRecent().filter((item) => item.to !== entry.to),
    ].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage can be unavailable (private mode); recents are optional.
  }
}

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const { workspaces = [], activeWorkspace } = useWorkspace();

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const matchesId = (w) => (w?.id ?? w?._id) === workspaceId;
  const workspace = workspaces.find(matchesId) || activeWorkspace;

  const allItems = useMemo(() => {
    const items = [];

    if (workspaceId && workspace) {
      getWorkspaceNavigation(
        workspaceId,
        workspace.type,
        workspace.role,
        workspace.category,
        workspace.workspaceSettings,
        workspace.modules
      ).forEach((section) => {
        (section.items || []).forEach((item) => {
          items.push({
            title: item.title,
            to: item.to,
            icon: item.icon,
            group: section.title || workspace.name || "Workspace",
          });
        });
      });

      // Not in any nav section any more (sidebar rail button only), but keep
      // it searchable with Ctrl+K for members who may open it.
      const deskItem = getLeadershipDeskItem(workspaceId, workspace.type, workspace.role);
      if (deskItem) {
        items.push({ ...deskItem, group: "Chama Operations" });
      }

      items.push(
        {
          title: "Notification center",
          to: `/workspace/${workspaceId}/notifications`,
          icon: Bell,
          group: "Account",
        },
        {
          title: "Notification preferences",
          to: `/workspace/${workspaceId}/notifications/preferences`,
          icon: Bell,
          group: "Account",
        }
      );
    }

    workspaces
      .filter((w) => !matchesId(w))
      .forEach((w) => {
        items.push({
          title: `Switch to ${w.name}`,
          to: `/workspace/${w.id ?? w._id}`,
          icon: Layers,
          group: "Workspaces",
        });
      });

    items.push(
      { title: "All workspaces", to: "/workspaces", icon: Home, group: "Account" },
      {
        title: "Account settings",
        to: "/account/settings",
        icon: Settings,
        group: "Account",
      }
    );

    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, workspace, workspaces]);

  const results = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);

    if (tokens.length === 0) {
      const recentTargets = new Set();
      const recent = readRecent()
        .map((entry) => allItems.find((item) => item.to === entry.to))
        .filter(Boolean)
        .filter((item) => {
          if (recentTargets.has(item.to)) return false;
          recentTargets.add(item.to);
          return true;
        })
        .slice(0, MAX_RECENT)
        .map((item) => ({ ...item, group: "Recent", icon: Clock }));

      const rest = allItems.filter((item) => !recentTargets.has(item.to));
      return [...recent, ...rest];
    }

    return allItems
      .filter((item) => {
        const haystack = `${item.title} ${item.group}`.toLowerCase();
        return tokens.every((token) => haystack.includes(token));
      })
      .sort((a, b) => {
        const first = tokens[0];
        const aStarts = a.title.toLowerCase().startsWith(first) ? 0 : 1;
        const bStarts = b.title.toLowerCase().startsWith(first) ? 0 : 1;
        return aStarts - bStarts;
      });
  }, [allItems, query]);

  // Reset when opened.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Wait for the input to mount.
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    document
      .getElementById(`cm-palette-option-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  function choose(item) {
    if (!item) return;
    writeRecent({ to: item.to, title: item.title });
    onClose();
    navigate(item.to);
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[activeIndex]);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Jump to a page or workspace"
    >
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-obsidian-border dark:bg-obsidian-card">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 dark:border-obsidian-border">
          <Search
            size={18}
            className="shrink-0 text-slate-400"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls="cm-palette-list"
            aria-activedescendant={`cm-palette-option-${activeIndex}`}
            placeholder="Jump to a page or workspace"
            className="h-14 w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-mist"
          />
          <kbd className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-400 dark:border-obsidian-border">
            Esc
          </kbd>
        </div>

        <ul
          id="cm-palette-list"
          role="listbox"
          className="max-h-[52vh] overflow-y-auto p-2"
        >
          {results.length === 0 ? (
            <li className="px-3 py-10 text-center text-sm text-slate-500 dark:text-mist-muted">
              Nothing matches &ldquo;{query}&rdquo;. Try a page name like
              &ldquo;loans&rdquo; or &ldquo;trust&rdquo;.
            </li>
          ) : (
            results.map((item, index) => {
              const Icon = item.icon || Search;
              const active = index === activeIndex;
              const showGroup =
                index === 0 || results[index - 1].group !== item.group;

              return (
                <li key={`${item.group}-${item.to}-${index}`} role="presentation">
                  {showGroup ? (
                    <p className="px-3 pb-1 pt-3 text-xs font-medium text-slate-400 dark:text-mist-muted">
                      {item.group}
                    </p>
                  ) : null}
                  <button
                    id={`cm-palette-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={() => choose(item)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      active
                        ? "bg-slate-100 text-slate-900 dark:bg-obsidian-raised dark:text-mist"
                        : "text-slate-700 dark:text-mist-muted"
                    }`}
                  >
                    <Icon size={17} className="shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    {active ? (
                      <CornerDownLeft
                        size={14}
                        className="shrink-0 text-slate-400"
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <div className="flex items-center gap-4 border-t border-slate-200 px-4 py-2.5 text-xs text-slate-400 dark:border-obsidian-border dark:text-mist-muted">
          <span>↑ ↓ to move</span>
          <span>Enter to open</span>
        </div>
      </div>
    </div>
  );
}