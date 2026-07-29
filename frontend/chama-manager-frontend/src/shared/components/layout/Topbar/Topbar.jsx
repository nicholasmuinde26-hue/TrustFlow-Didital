import WorkspaceSwitcher from "../WorkspaceSwitcher";
import SearchBar from "../SearchBar";
import ThemeToggle from "../ThemeToggle";
import NotificationButton from "../NotificationButton";
import UserMenu from "../UserMenu";

export default function Topbar() {
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
      px-8
      backdrop-blur-xl

      dark:border-slate-800
      dark:bg-slate-900/80
      "
    >
      <WorkspaceSwitcher />

      <div className="flex items-center gap-4">
        <SearchBar />

        <ThemeToggle />

        <NotificationButton />

        <UserMenu />
      </div>
    </header>
  );
}