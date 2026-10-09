import { Menu } from "lucide-react";
import WorkspaceSwitcher from "../WorkspaceSwitcher";
import SearchBar from "../SearchBar";
import ThemeToggle from "../ThemeToggle";
import NotificationButton from "../NotificationButton";
import UserMenu from "../UserMenu";
import PlanBadge from "@/modules/billing/components/PlanBadge";
import ToolsButton from "./ToolsButton";

export default function Topbar({ onMenuToggle }) {
  return (
    <header
      className="
      workspace-topbar
      sticky
      top-0
      z-30
      flex
      h-16 sm:h-20
      items-center
      justify-between
      border-b
      border-slate-200
      bg-white/80
      px-2
      sm:px-8
      backdrop-blur-xl

      dark:border-obsidian-border
      dark:bg-obsidian/80
      "
    >
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={onMenuToggle}
          className="
            flex h-9 w-9 items-center justify-center rounded-lg
            text-slate-500
            hover:bg-slate-100
            focus:outline-none
            dark:text-mist-muted
            dark:hover:bg-obsidian-card
            lg:hidden
          "
          aria-label="Open sidebar"
        >
          <Menu size={20} />
        </button>

        <WorkspaceSwitcher />

        <ToolsButton onOpen={onMenuToggle} />
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-4">
        <SearchBar />

        <div className="hidden sm:block"><PlanBadge /></div>

        <ThemeToggle />

        <NotificationButton />

        <UserMenu />
      </div>
    </header>
  );
}
