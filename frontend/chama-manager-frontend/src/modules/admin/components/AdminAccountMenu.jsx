import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, CornerUpLeft, LogOut, UserCog } from "lucide-react";
import clsx from "clsx";
import useAuth from "@/app/hooks/useAuth";
import useAdminAccess from "../hooks/useAdminAccess";
import { PERMISSION_LABELS, WORKSPACE_NAMES } from "../config/adminNavigation";

/**
 * Admin-only account menu. Unlike the member menu it has no workspaces or
 * invitations — just identity, access scope, the way back to the member
 * app, and sign out.
 */
export default function AdminAccountMenu() {
  const { user, logout } = useAuth();
  const { isSuperAdmin, category, permissions } = useAdminAccess();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const name = user?.name || "Admin";
  const contact = user?.email || user?.phone || "";
  const photo = user?.avatar_url || user?.photoURL || user?.avatar || null;
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const scope = isSuperAdmin
    ? ["Full platform access"]
    : Object.entries(permissions || {})
        .filter(([, enabled]) => enabled)
        .map(([key]) => PERMISSION_LABELS[key])
        .filter(Boolean);

  const go = (to) => {
    setOpen(false);
    navigate(to);
  };

  const signOut = async () => {
    setOpen(false);
    await logout();
    navigate("/login", { replace: true });
  };

  const Avatar = ({ size }) => (
    <span
      className={clsx(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-violet-600 to-indigo-700 text-xs font-bold text-white",
        size
      )}
    >
      {photo ? (
        <img src={photo} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        initials || "A"
      )}
    </span>
  );

  const itemCls =
    "flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1 pl-1 pr-2 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
      >
        <Avatar size="h-8 w-8" />
        <span className="hidden max-w-[140px] truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100 md:block">
          {name}
        </span>
        <ChevronDown size={15} className={clsx("text-slate-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
            <Avatar size="h-11 w-11" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{name}</p>
              {contact && <p className="truncate text-xs text-slate-500">{contact}</p>}
            </div>
          </div>

          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {isSuperAdmin ? "Super Admin" : WORKSPACE_NAMES[category] || "Sub-Admin"}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(scope.length ? scope : ["No scopes assigned"]).slice(0, 7).map((label) => (
                <span
                  key={label}
                  className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="py-1">
            <button type="button" role="menuitem" onClick={() => go("/account/settings")} className={itemCls}>
              <UserCog size={16} className="text-slate-400" />
              Profile & security
            </button>
            <button type="button" role="menuitem" onClick={() => go("/home")} className={itemCls}>
              <CornerUpLeft size={16} className="text-slate-400" />
              Exit to member app
            </button>
          </div>

          <div className="border-t border-slate-100 py-1 dark:border-slate-800">
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
