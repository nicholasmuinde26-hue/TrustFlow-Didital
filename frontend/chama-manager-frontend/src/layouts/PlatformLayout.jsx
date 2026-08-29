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

      {/*
        No max-w/mx-auto here on purpose — that used to cap every page in
        this layout (including /home) at ~1024px and center it on wide
        screens, regardless of what width the page itself wanted. The
        base padding stays (pages besides /home rely on it for their own
        spacing); a page that wants a narrower reading column, like the
        create-* forms, still applies its own max-w/mx-auto internally.
      */}
      <main className="w-full px-6 py-10 lg:px-8">{children ?? <Outlet />}</main>
    </div>
  );
}