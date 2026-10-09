import { useEffect, useMemo, useState } from "react";
import { Home, Layers, MoreHorizontal, Search, User, X } from "lucide-react";
import { Link, NavLink, useLocation, useParams } from "react-router-dom";
import { findWorkspaceNavigationMatch } from "@/modules/workspaces/config/workspaceNavigation";

const SHORT_LABELS = {
  Overview: "Home",
  Dashboard: "Money",
  "Finance Dashboard": "Money",
  Contributions: "Contribute",
  "Record Contribution": "Record",
  "Meeting Records": "Meetings",
  "Income Statement": "Income",
  "Receipts & Payments": "Receipts",
  "General Ledger": "Ledger",
  "Trust Timeline": "Trust",
  "Official Accountability": "Officials",
  "Savings Share-Out": "Share-out",
  "Merry-Go-Round (MGR)": "MGR",
};

function routeIsWithin(pathname, to) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

function choosePrimary(sections = []) {
  const items = sections.flatMap((section) => (section.items || []).map((item) => ({
    ...item,
    sectionKey: section.sectionKey,
  })));
  const find = (...titles) => items.find((item) => titles.includes(item.title));
  const preferred = [
    find("Overview", "Home"),
    find("Members"),
    find("Dashboard", "Contributions", "Money"),
    find("Loans", "Emergency Loans", "Meeting Records", "Meetings"),
    find("Messages", "Chat", "Announcements"),
  ].filter(Boolean);
  const selected = [];
  const routes = new Set();
  for (const item of [...preferred, ...items]) {
    if (selected.length === 5) break;
    if (routes.has(item.to)) continue;
    routes.add(item.to);
    selected.push(item);
  }
  return selected;
}

export default function MobileBottomNav({ sections = [], extraItems = [] }) {
  const { workspaceId } = useParams();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inWorkspace = Boolean(workspaceId);
  const primary = useMemo(() => choosePrimary(sections), [sections]);
  const routeOwner = findWorkspaceNavigationMatch(sections, pathname);
  const primaryRoutes = new Set(primary.map((item) => item.to));
  const moreSections = sections.map((section) => ({
    ...section,
    items: (section.items || []).filter((item) => !primaryRoutes.has(item.to)),
  })).filter((section) => section.items.length > 0);
  const query = search.trim().toLowerCase();
  const filteredSections = moreSections.map((section) => ({
    ...section,
    items: !query || section.title?.toLowerCase().includes(query)
      ? section.items
      : section.items.filter((item) => item.title.toLowerCase().includes(query)),
  })).filter((section) => section.items.length > 0);
  const filteredExtras = extraItems.filter((item) => item.title.toLowerCase().includes(query));
  const platformItems = [
    { label: "Home", to: "/home", icon: Home, end: true },
    { label: "Workspaces", to: "/workspaces", icon: Layers },
    { label: "Profile", to: "/account/settings", icon: User },
  ];

  useEffect(() => {
    if (!moreOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moreOpen]);

  useEffect(() => {
    setMoreOpen(false);
    setSearch("");
  }, [pathname]);

  const primaryOwnsCurrentRoute = primary.some((item) => item.to === routeOwner?.item.to ||
    (item.title === "Dashboard" && routeOwner?.section.sectionKey === "money"));
  const moreIsCurrent = Boolean((routeOwner && !primaryOwnsCurrentRoute) || extraItems.some((item) => routeIsWithin(pathname, item.to)));

  return (
    <>
      <nav
        aria-label="Primary mobile navigation"
        className="workspace-mobile-nav fixed inset-x-0 bottom-0 z-40 flex min-h-16 items-stretch justify-around border-t border-obsidian-border bg-obsidian/95 px-1 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1.5 text-mist backdrop-blur-xl lg:hidden"
      >
        {inWorkspace && primary.length > 0 ? primary.map(({ title, icon: Icon, to, sectionKey }) => (
          <NavLink
            key={to}
            to={to}
            end={title === "Overview" || title === "Home" || title === "Dashboard"}
            aria-label={title}
            title={title}
            className={({ isActive }) => {
              const active = title === "Dashboard" && sectionKey === "money"
                ? routeOwner?.section.sectionKey === "money"
                : isActive;
              return `flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-1.5 text-[10px] font-semibold transition ${active ? "text-mint" : "text-mist-muted hover:text-mist"}`;
            }}
          >
            {Icon && <Icon size={20} strokeWidth={2} aria-hidden="true" />}
            <span className="max-w-full truncate">{SHORT_LABELS[title] || title}</span>
          </NavLink>
        )) : platformItems.map(({ label, to, icon: Icon, end }) => (
          <NavLink
            key={label}
            to={to}
            end={end}
            className={({ isActive }) => `flex flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[11px] font-medium transition ${isActive ? "text-mint" : "text-mist-muted"}`}
          >
            <Icon size={21} strokeWidth={2} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
        {inWorkspace && primary.length > 0 && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="Open all workspace sections"
            aria-expanded={moreOpen}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-1.5 text-[10px] font-semibold transition ${moreOpen || moreIsCurrent ? "text-mint" : "text-mist-muted hover:text-mist"}`}
          >
            <MoreHorizontal size={20} strokeWidth={2} aria-hidden="true" />
            More
          </button>
        )}
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="presentation">
          <button type="button" aria-label="Close all sections" onClick={() => setMoreOpen(false)} className="absolute inset-0 h-full w-full bg-slate-950/60 backdrop-blur-sm" />
          <section role="dialog" aria-modal="true" aria-labelledby="mobile-sections-title" className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[28px] border-t border-white/10 bg-[#111b18] pb-[max(env(safe-area-inset-bottom),0.5rem)] text-white shadow-2xl">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/20" />
            <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
              <div>
                <h2 id="mobile-sections-title" className="text-base font-bold">All sections</h2>
                <p className="mt-0.5 text-xs text-slate-400">Jump straight to any workspace tool</p>
              </div>
              <button type="button" onClick={() => setMoreOpen(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.06] text-slate-300 hover:bg-white/10" aria-label="Close sections"><X size={18} /></button>
            </header>
            <label className="mx-4 mb-3 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5">
              <Search size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a section" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
            </label>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pb-5">
              {filteredExtras.length > 0 && (
                <div>
                  <h3 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-300">Leadership</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {filteredExtras.map(({ title, to, icon: Icon }) => (
                      <NavLink key={to} to={to} onClick={() => setMoreOpen(false)} className="flex min-h-12 items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-3 text-xs font-semibold text-slate-200 hover:bg-white/[0.08]">
                        {Icon && <Icon size={18} className="shrink-0" aria-hidden="true" />}{title}
                      </NavLink>
                    ))}
                  </div>
                </div>
              )}
              {filteredSections.map((section, index) => (
                <div key={section.sectionKey || section.title || index}>
                  {section.title && <h3 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-300">{section.title}</h3>}
                  <div className="grid grid-cols-2 gap-2">
                    {section.items.map(({ title, icon: Icon, to, locked }) => (
                      <NavLink key={to} to={to} onClick={() => setMoreOpen(false)} className={({ isActive }) => `flex min-h-12 min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${isActive ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-white/[0.06] bg-white/[0.03] text-slate-300 hover:bg-white/[0.08]"}`}>
                        {Icon && <Icon size={17} className="shrink-0" aria-hidden="true" />}
                        <span className="min-w-0 flex-1 truncate">{title}</span>
                        {locked && <span className="shrink-0 text-amber-300" aria-label="Locked">·</span>}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
              {filteredSections.length === 0 && filteredExtras.length === 0 && <p className="py-10 text-center text-sm text-slate-400">No sections match “{search}”.</p>}
              <Link to="/workspaces" onClick={() => setMoreOpen(false)} className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] px-3 py-3 text-xs font-semibold text-slate-300 hover:bg-white/[0.06]"><Layers size={15} /> Switch workspace</Link>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
