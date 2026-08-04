import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  User,
  Settings,
  LogOut,
} from "lucide-react";

import useAuth from "@/app/hooks/useAuth";

export default function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);

  const name = user?.name || "Account";
  const email = user?.email || "";

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
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="
        flex
        items-center
        gap-3
        rounded-xl
        border
        border-slate-200
        bg-white
        px-3
        py-2
        transition-all

        hover:bg-slate-50

        dark:border-slate-700
        dark:bg-slate-800
        dark:hover:bg-slate-700
        "
      >
        <div
          className="
          flex
          h-10
          w-10
          items-center
          justify-center
          rounded-full
          bg-primary
          font-semibold
          text-white
          "
        >
          {initials || <User size={18} />}
        </div>

        <div className="hidden text-left lg:block">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {name}
          </p>

          {email && (
            <p className="text-xs text-slate-500">{email}</p>
          )}
        </div>

        <ChevronDown
          size={18}
          className="text-slate-500"
        />
      </button>

      {open && (
        <div
          className="
          absolute
          right-0
          mt-3
          w-64
          overflow-hidden
          rounded-2xl
          border
          border-slate-200
          bg-white
          shadow-xl
          dark:border-slate-700
          dark:bg-slate-900
          z-50
          "
        >
          <div className="border-b border-slate-200 p-4 dark:border-slate-700">
            <p className="font-semibold">{name}</p>

            {email && (
              <p className="text-sm text-slate-500">{email}</p>
            )}
          </div>

          <button
            className="
            flex
            w-full
            items-center
            gap-3
            px-4
            py-3
            transition-colors
            hover:bg-slate-100
            dark:hover:bg-slate-800
            "
          >
            <User size={18} />
            Profile
          </button>

          <button
            className="
            flex
            w-full
            items-center
            gap-3
            px-4
            py-3
            transition-colors
            hover:bg-slate-100
            dark:hover:bg-slate-800
            "
          >
            <Settings size={18} />
            Settings
          </button>

          <div className="border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={handleSignOut}
              className="
              flex
              w-full
              items-center
              gap-3
              px-4
              py-3
              text-red-500
              transition-colors
              hover:bg-red-50
              dark:hover:bg-red-950/30
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