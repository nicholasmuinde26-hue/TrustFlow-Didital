import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  User,
  LogOut,
  Mail,
  LayoutGrid,
} from "lucide-react";

import useAuth from "@/app/hooks/useAuth";

export default function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the dropdown on outside click + touch
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event) {
      if (menuRef.current &&!menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [open]);

  function goToProfile() {
    setOpen(false);
    navigate("/account/settings");
  }

  // Reachable from anywhere in the app shell — including from deep
  // inside a specific workspace, which has no other path back to
  // /workspaces or /invitations besides the WorkspaceSwitcher.
  function goToWorkspaces() {
    setOpen(false);
    navigate("/workspaces");
  }

  function goToInvitations() {
    setOpen(false);
    navigate("/invitations");
  }

  const name = user?.name || "Account";
  const email = user?.email || "";
  const photo = user?.avatar_url || user?.photoURL || user?.avatar || null; // check both common fields

  const initials = name
   .split(" ")
   .map((part) => part[0])
   .slice(0, 2)
   .join("")
   .toUpperCase();

  async function handleSignOut() {
    setOpen(false);
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((prev) =>!prev)}
        className="
        flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2
        transition-all hover:bg-slate-50
        dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700
        "
      >
        {/* AVATAR: Photo or Initials */}
        <div
          className="
          flex h-10 w-10 items-center justify-center overflow-hidden rounded-full
          bg-primary font-semibold text-white
          "
        >
          {photo? (
            <img
              src={photo}
              alt={name}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer" // fixes google avatar CORS
            />
          ) : (
            initials || <User size={18} />
          )}
        </div>

        <div className="hidden text-left lg:block">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{name}</p>
          {email && <p className="text-xs text-slate-500">{email}</p>}
        </div>

        <ChevronDown
          size={18}
          className={`text-slate-500 transition-transform ${open? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className="
          absolute right-0 mt-3 w-64 overflow-hidden rounded-2xl border border-slate-200
          bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 z-50
          "
        >
          {/* Header with photo */}
          <div className="flex items-center gap-3 border-b border-slate-200 p-4 dark:border-slate-700">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-primary font-semibold text-white">
              {photo? (
                <img
                  src={photo}
                  alt={name}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                initials || <User size={20} />
              )}
            </div>
            <div>
              <p className="font-semibold">{name}</p>
              {email && <p className="text-sm text-slate-500">{email}</p>}
            </div>
          </div>

          <button
            onClick={goToWorkspaces}
            className="
            flex w-full items-center gap-3 px-4 py-3 transition-colors
            hover:bg-slate-100 dark:hover:bg-slate-800
            "
          >
            <LayoutGrid size={18} />
            All Workspaces
          </button>

          <button
            onClick={goToInvitations}
            className="
            flex w-full items-center gap-3 px-4 py-3 transition-colors
            hover:bg-slate-100 dark:hover:bg-slate-800
            "
          >
            <Mail size={18} />
            Invitations
          </button>

          <button
            onClick={goToProfile}
            className="
            flex w-full items-center gap-3 px-4 py-3 transition-colors
            hover:bg-slate-100 dark:hover:bg-slate-800
            "
          >
            <User size={18} />
            Profile & Settings
          </button>

          <div className="border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={handleSignOut}
              className="
              flex w-full items-center gap-3 px-4 py-3 text-red-500 transition-colors
              hover:bg-red-50 dark:hover:bg-red-950/30
              "
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}