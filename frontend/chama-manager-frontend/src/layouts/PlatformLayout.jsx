import { Outlet } from "react-router-dom";

import Logo from "@/shared/components/layout/Logo";
import ThemeToggle from "@/shared/components/layout/ThemeToggle/ThemeToggle";
import NotificationButton from "@/shared/components/layout/NotificationButton/NotificationButton";
import UserMenu from "@/shared/components/layout/UserMenu/UserMenu";
import WorkspaceSwitcher from "@/shared/components/layout/WorkspaceSwitcher/WorkspaceSwitcher";

// The shell for the "User Platform" layer — /home (onboarding, only
// ever seen by a user with zero workspaces), /workspaces (the hub, for
// everyone else), /invitations, /account/settings. No left Sidebar here
// since these pages aren't scoped to one workspace, but the
// WorkspaceSwitcher still shows up (it renders null on its own for a
// brand-new user with no active workspace yet) so anyone who already
// has workspaces can jump straight into one or create another without
// getting stuck on this layer.
export default function PlatformLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header
        className="
        sticky top-0 z-30 flex h-20 items-center justify-between gap-4
        border-b border-slate-200 bg-white/80 px-6 backdrop-blur-xl
        dark:border-slate-800 dark:bg-slate-900/80
        lg:px-10
        "
      >
        <div className="flex items-center gap-4 min-w-0">
          <Logo />
          <WorkspaceSwitcher />
        </div>

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