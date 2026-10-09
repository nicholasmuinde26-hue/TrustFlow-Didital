import { useEffect, useRef } from "react";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";

import { ACCENTS, CountBadge } from "./DeskUI";

// ========================================
// LEADERSHIP DESK SIDEBAR
// ========================================
//
// The desk's navigation, in one place. Each area (Overview, People, Money,
// Operations, Settings) is a labelled section holding the pages inside it, in
// that area's colour. Counts for "someone is waiting on you" sit on the page
// and roll up onto the section, so they stay visible even when it is folded.
//
//   - Desktop: a sticky column beside the page. It can shrink to an icon rail.
//   - Mobile:  the same list inside a slide-in drawer (see DeskSidebarDrawer).
//
// The sidebar owns no state about *which* page is open or what is folded; the
// desk page passes everything in, so the URL stays the single source of truth.
//
// ========================================

function NavItem({ tab, tone, selected, count, compact, onSelect }) {
  const Icon = tab.icon;
  const danger = tab.tone === "danger";
  const itemTone = danger ? ACCENTS.rose : tone;
  const label = count ? `${tab.label}, ${count} waiting` : tab.label;

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => onSelect(tab.id)}
        aria-current={selected ? "page" : undefined}
        aria-label={label}
        title={tab.label}
        className={`relative mx-auto grid h-10 w-10 place-items-center rounded-xl transition focus:outline-none focus-visible:ring-2 ${itemTone.ring} ${
          selected
            ? itemTone.soft
            : danger
            ? "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
            : "text-slate-500 hover:bg-slate-100 dark:text-mist-muted dark:hover:bg-obsidian-raised"
        }`}
      >
        <Icon size={17} aria-hidden="true" />
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-rose-600 px-1 text-[9px] font-bold leading-none text-white"
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(tab.id)}
      aria-current={selected ? "page" : undefined}
      aria-label={label}
      className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition focus:outline-none focus-visible:ring-2 ${itemTone.ring} ${
        selected
          ? itemTone.soft
          : danger
          ? "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
          : "text-slate-600 hover:bg-slate-100 dark:text-mist-muted dark:hover:bg-obsidian-raised"
      }`}
    >
      {selected && (
        <span aria-hidden="true" className={`absolute inset-y-1.5 left-0 w-[3px] rounded-r-full ${itemTone.bar}`} />
      )}
      <Icon size={17} aria-hidden="true" className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{tab.label}</span>
      <CountBadge count={count} />
    </button>
  );
}

function SidebarBody({
  groups,
  activeTab,
  activeGroupId,
  badges,
  groupBadge,
  foldedGroups,
  onToggleGroup,
  onSelect,
  compact,
}) {
  return (
    <nav aria-label="Leadership Desk sections" className="space-y-0.5">
      {groups.map((group, index) => {
        const GroupIcon = group.icon;
        const tone = ACCENTS[group.accent];
        const single = group.tabs.length === 1;
        const folded = !compact && !single && Boolean(foldedGroups[group.id]);
        const total = groupBadge(group);
        const listId = `desk-nav-${group.id}`;

        // Areas with a single page (Overview) need no heading of their own.
        if (single) {
          const tab = group.tabs[0];
          return (
            <div key={group.id} className={compact && index > 0 ? "border-t border-slate-100 pt-2 dark:border-obsidian-border" : ""}>
              <NavItem
                tab={tab}
                tone={tone}
                selected={tab.id === activeTab}
                count={badges[tab.id] || 0}
                compact={compact}
                onSelect={onSelect}
              />
            </div>
          );
        }

        return (
          <div
            key={group.id}
            className={compact ? "space-y-1 border-t border-slate-100 pt-2 dark:border-obsidian-border" : "pt-5"}
          >
            {!compact && (
              <button
                type="button"
                onClick={() => onToggleGroup(group.id)}
                aria-expanded={!folded}
                aria-controls={listId}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[11px] font-bold uppercase tracking-wider transition focus:outline-none focus-visible:ring-2 ${tone.ring} ${
                  group.id === activeGroupId ? tone.text : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                }`}
              >
                <GroupIcon size={13} aria-hidden="true" />
                <span className="flex-1">{group.label}</span>
                {folded && total > 0 && <CountBadge count={total} />}
                <ChevronDown
                  size={13}
                  aria-hidden="true"
                  className={`transition-transform ${folded ? "-rotate-90" : ""}`}
                />
              </button>
            )}

            {!folded && (
              <div id={listId} className={compact ? "space-y-1" : "mt-1 space-y-0.5"}>
                {group.tabs.map((tab) => (
                  <NavItem
                    key={tab.id}
                    tab={tab}
                    tone={tone}
                    selected={tab.id === activeTab}
                    count={badges[tab.id] || 0}
                    compact={compact}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

// Who this desk belongs to. The page used to repeat the chama name in a big
// header above everything; it now lives here, once, at the top of the nav.
function SidebarIdentity({ name, role, compact }) {
  const initials = String(name || "C")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className={`flex items-center border-b border-slate-100 dark:border-obsidian-border ${compact ? "justify-center p-3" : "gap-3 px-4 py-4"}`}>
      <span
        title={compact ? name : undefined}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-sm font-bold text-white"
      >
        {initials}
      </span>
      {!compact && (
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{name}</p>
          <p className="truncate text-xs capitalize text-slate-500 dark:text-mist-muted">{role} · Leadership Desk</p>
        </div>
      )}
    </div>
  );
}

// Desktop column. Hidden below lg, where the drawer takes over.
export default function DeskSidebar({ collapsed, onToggleCollapsed, identity, ...body }) {
  return (
    <aside
      className={`hidden shrink-0 transition-[width] duration-200 lg:sticky lg:top-2 lg:block lg:max-h-[calc(100vh-7rem)] lg:self-start ${
        collapsed ? "w-[68px]" : "w-64"
      }`}
    >
      <div className="flex max-h-[inherit] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-obsidian-border dark:bg-obsidian-card">
        {identity ? <SidebarIdentity {...identity} compact={collapsed} /> : null}
        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${collapsed ? "px-2 py-3" : "px-3 pb-4 pt-2"}`}>
          <SidebarBody {...body} compact={collapsed} />
        </div>
        <div className={`border-t border-slate-100 dark:border-obsidian-border ${collapsed ? "p-2" : "p-2.5"}`}>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand the sidebar" : "Collapse the sidebar"}
            title={collapsed ? "Expand the sidebar" : "Collapse the sidebar"}
            className={`flex items-center gap-2 rounded-xl text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-mist-muted dark:hover:bg-obsidian-raised ${
              collapsed ? "mx-auto h-10 w-10 justify-center" : "w-full px-2.5 py-2"
            }`}
          >
            {collapsed ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}
            {!collapsed && "Collapse"}
          </button>
        </div>
      </div>
    </aside>
  );
}

// Mobile drawer. Closes on Escape, on a tap outside, and after a page is chosen.
export function DeskSidebarDrawer({ open, onClose, title, subtitle, onSelect, ...body }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => closeRef.current?.focus());
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[65] lg:hidden">
      <div className="absolute inset-0 bg-slate-950/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Leadership Desk menu"
        className="absolute inset-y-0 left-0 flex w-[86%] max-w-xs flex-col bg-white shadow-2xl dark:bg-obsidian-card"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-obsidian-border">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{subtitle}</p>
            <p className="truncate text-base font-bold text-slate-900 dark:text-white">{title}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-mist-muted dark:hover:bg-obsidian-raised"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-8">
          <SidebarBody
            {...body}
            compact={false}
            onSelect={(id) => {
              onSelect(id);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
