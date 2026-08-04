import { Outlet } from "react-router-dom";

import Logo from "@/shared/components/layout/Logo";
import ThemeToggle from "@/shared/components/layout/ThemeToggle";
import NotificationButton from "@/shared/components/layout/NotificationButton";
import UserMenu from "@/shared/components/layout/UserMenu";

// The shell for the "User Platform" layer (/home and friends) — the user
// hasn't opened a workspace yet, so there's no Sidebar and no
// WorkspaceSwitcher here, just identity + account-level actions.
export default function PlatformLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header
        className="
        sticky top-0 z-30 flex h-20 items-center justify-between
        border-b border-slate-200 bg-white/80 px-6 backdrop-blur-xl
        dark:border-slate-800 dark:bg-slate-900/80
        lg:px-10
        "
      >
        <Logo />

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <NotificationButton />
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 lg:px-8">
        {children ?? <Outlet />}
      </main>
    </div>
  );
}