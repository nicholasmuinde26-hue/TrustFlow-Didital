import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Building2,
  Wallet,
  Plus,
  Store,
  LayoutGrid,
  UserPlus,
  Check,
} from "lucide-react";

import useWorkspace from "@/app/hooks/useWorkspace";

const TYPE_META = {
  chama: { label: "Chamas", icon: Building2 },
  business: { label: "Businesses", icon: Store },
  contribution: { label: "Contribution Groups", icon: Wallet },
};

function normalizeType(type) {
  const t = String(type || "").toLowerCase();
  if (t === "business") return "business";
  if (t === "contribution-group" || t === "contribution_group" || t === "contribution") {
    return "contribution";
  }
  return "chama";
}

function iconFor(type) {
  return TYPE_META[normalizeType(type)].icon;
}

// Everything a user can do to create or join a new workspace, in one
// place — surfaced from inside the switcher so it's reachable from
// any screen in the app shell without ever routing back through /home.
const CREATE_ACTIONS = [
  { to: "/chamas/new", icon: Building2, label: "New Chama" },
  { to: "/contribution-groups/new", icon: Wallet, label: "New Contribution Group" },
  { to: "/business/new", icon: Store, label: "New Business" },
  { to: "/chamas/join", icon: UserPlus, label: "Join a Chama" },
];

export default function WorkspaceSwitcher() {
  const navigate = useNavigate();
  const { workspaces, activeWorkspace, selectWorkspace } = useWorkspace();

  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setCreateOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Reset the create sub-menu every time the switcher itself closes,
  // so it doesn't reopen already-expanded next time.
  useEffect(() => {
    if (!open) setCreateOpen(false);
  }, [open]);

  function handleSelect(workspace) {
    selectWorkspace(workspace);
    setOpen(false);

    const workspaceId = workspace.id ?? workspace._id;
    const type = normalizeType(workspace.type);

    navigate(type === "business" ? `/workspace/${workspaceId}/business` : `/workspace/${workspaceId}`);
  }

  function handleCreateNavigate(to) {
    setOpen(false);
    navigate(to);
  }

  if (!activeWorkspace) {
    return null;
  }

  const ActiveIcon = iconFor(activeWorkspace.type);

  // Group workspaces by type so switching between many workspaces of
  // different kinds stays easy to scan, instead of one flat list.
  const grouped = workspaces.reduce((acc, workspace) => {
    const type = normalizeType(workspace.type);
    (acc[type] ||= []).push(workspace);
    return acc;
  }, {});

  const activeId = activeWorkspace.id ?? activeWorkspace._id;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="
          flex
          items-center
          gap-2.5
          rounded-xl
          border
          border-slate-200
          bg-white
          px-2.5
          py-1.5
          sm:px-4
          sm:py-2.5
          transition-all
          hover:bg-slate-50
          dark:border-slate-700
          dark:bg-slate-800
          dark:hover:bg-slate-700
          max-w-[200px]
          sm:max-w-xs
        "
      >
        <ActiveIcon size={18} className="text-primary shrink-0" />

        <div className="text-left min-w-0">
          <p className="text-[10px] text-slate-500 leading-none mb-0.5 hidden sm:block">Workspace</p>

          <p className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm truncate">
            {activeWorkspace.name}
          </p>
        </div>

        <ChevronDown
          size={16}
          className={`transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className="
            absolute
            left-0
            mt-3
            w-80
            max-h-[80vh]
            overflow-hidden
            rounded-2xl
            border
            border-slate-200
            bg-white
            shadow-xl
            dark:border-slate-700
            dark:bg-slate-900
            z-50
            flex
            flex-col
          "
        >
          <div className="flex items-center justify-between border-b border-slate-200 p-3 dark:border-slate-700">
            <p className="text-sm font-semibold">Switch Workspace</p>

            <button
              onClick={() => {
                setOpen(false);
                navigate("/workspaces");
              }}
              className="flex items-center gap-1 text-xs font-bold text-violet-600 hover:underline dark:text-violet-400"
            >
              <LayoutGrid size={13} />
              All
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto py-2">
            {Object.entries(TYPE_META).map(([type, meta]) => {
              const items = grouped[type];
              if (!items?.length) return null;

              const GroupIcon = meta.icon;

              return (
                <div key={type} className="mb-1 last:mb-0">
                  <p className="flex items-center gap-1.5 px-4 pb-1 pt-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <GroupIcon size={11} />
                    {meta.label}
                  </p>

                  {items.map((workspace) => {
                    const id = workspace.id ?? workspace._id;
                    const isActive = id === activeId;

                    return (
                      <button
                        key={id}
                        onClick={() => handleSelect(workspace)}
                        className="
                          flex
                          w-full
                          items-center
                          gap-3
                          px-4
                          py-2.5
                          text-left
                          transition-colors
                          hover:bg-slate-100
                          dark:hover:bg-slate-800
                        "
                      >
                        <span className="flex-1 truncate text-sm">{workspace.name}</span>

                        {isActive && <Check size={15} className="text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              );
            })}

            {workspaces.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-slate-400">No other workspaces yet.</p>
            )}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setCreateOpen((prev) => !prev)}
              className="
                flex
                w-full
                items-center
                gap-2.5
                px-4
                py-3
                text-xs
                font-bold
                text-primary
                transition-colors
                hover:bg-primary/5
              "
            >
              <Plus size={16} className={`transition-transform ${createOpen ? "rotate-45" : ""}`} />
              Create or Join a Workspace
            </button>

            {createOpen && (
              <div className="space-y-0.5 px-2 pb-2">
                {CREATE_ACTIONS.map(({ to, icon: Icon, label }) => (
                  <button
                    key={to}
                    onClick={() => handleCreateNavigate(to)}
                    className="
                      flex
                      w-full
                      items-center
                      gap-2.5
                      rounded-xl
                      px-3
                      py-2
                      text-left
                      text-xs
                      font-semibold
                      text-slate-600
                      transition-colors
                      hover:bg-slate-100
                      dark:text-slate-300
                      dark:hover:bg-slate-800
                    "
                  >
                    <Icon size={15} className="text-slate-400 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
