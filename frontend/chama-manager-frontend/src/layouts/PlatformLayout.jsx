import { Link, Outlet } from "react-router-dom";

import Logo from "@/shared/components/layout/Logo";
import ThemeToggle from "@/shared/components/layout/ThemeToggle/ThemeToggle";
import NotificationButton from "@/shared/components/layout/NotificationButton/NotificationButton";
import UserMenu from "@/shared/components/layout/UserMenu/UserMenu";
import WorkspaceSwitcher from "@/shared/components/layout/WorkspaceSwitcher/WorkspaceSwitcher";
import MobileBottomNav from "@/shared/components/layout/MobileBottomNav/MobileBottomNav";
import BrandMark from "@/shared/components/layout/BrandMark";

// The shell for the "User Platform" layer — /home (onboarding, only
// ever seen by a user with zero workspaces), /workspaces (the hub, for
// everyone else), /invitations, /account/settings. No left Sidebar here
// since these pages aren't scoped to one workspace, but the
// WorkspaceSwitcher still shows up (it renders null on its own for a
// brand-new user with no active workspace yet) so anyone who already
// has workspaces can jump straight into one or create another without
// getting stuck on this layer.
//
// pb-24 on <main> on mobile only (lg:pb-0) keeps page content clear of
// the fixed MobileBottomNav; that nav is lg:hidden so it never affects
// desktop, where the Topbar remains the only navigation surface.
export default function PlatformLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#f5f8f6] dark:bg-obsidian">
      <header
        className="
        sticky top-0 z-30 flex h-16 items-center justify-between gap-2
        border-b border-slate-200 bg-white/80 px-3 backdrop-blur-xl
        dark:border-obsidian-border dark:bg-obsidian/80
        sm:h-20 sm:gap-4 sm:px-6 lg:px-10
        "
      >
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <div className="hidden sm:block"><Logo /></div>
          <Link to="/home" className="shrink-0 sm:hidden" aria-label="ChamaManager home"><BrandMark size={34} /></Link>
          <WorkspaceSwitcher />
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-4">
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
      <main className="platform-page-container w-full min-w-0 overflow-x-hidden px-3 py-5 pb-28 sm:px-6 sm:py-8 sm:pb-24 lg:px-8 lg:pb-10">
        {children ?? <Outlet />}
      </main>

      <MobileBottomNav />
    </div>
  );
}
