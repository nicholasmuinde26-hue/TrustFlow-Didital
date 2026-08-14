import { Menu } from "lucide-react";
import WorkspaceSwitcher from "../WorkspaceSwitcher";
import SearchBar from "../SearchBar";
import ThemeToggle from "../ThemeToggle";
import NotificationButton from "../NotificationButton";
import UserMenu from "../UserMenu";

export default function Topbar({ onMenuToggle }) {
  return (
    <header
      className="
      sticky
      top-0
      z-30
      flex
      h-20
      items-center
      justify-between
      border-b
      border-slate-200
      bg-white/80
      px-4
      sm:px-8
      backdrop-blur-xl

      dark:border-slate-800
      dark:bg-slate-900/80
      "
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={onMenuToggle}
          className="
            rounded-lg
            p-2
            text-slate-500
            hover:bg-slate-100
            focus:outline-none
            dark:text-slate-400
            dark:hover:bg-slate-800
            lg:hidden
          "
          aria-label="Open sidebar"
        >
          <Menu size={24} />
        </button>

        <WorkspaceSwitcher />
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <SearchBar />

        <ThemeToggle />

        <NotificationButton />

        <UserMenu />
      </div>
    </header>
  );
}