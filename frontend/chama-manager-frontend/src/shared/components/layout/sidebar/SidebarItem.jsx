import { NavLink } from "react-router-dom";
import { Lock } from "lucide-react";

export default function SidebarItem({
  icon: Icon,
  title,
  to,
  locked = false,
}) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `
        group
        flex
        items-center
        gap-3
        rounded-2xl
        px-4
        py-3
        text-sm
        font-medium
        transition-all
        duration-200

        ${
          isActive
            ? "bg-primary text-white shadow-lg shadow-primary/20 dark:bg-mint-deep dark:text-mint dark:shadow-none"
            : `
              text-slate-600
              hover:bg-slate-100
              hover:text-slate-900

              dark:text-mist-muted
              dark:hover:bg-obsidian-card
              dark:hover:text-mist
            `
        }
        `
      }
    >
      <Icon
        size={20}
        className="transition-transform duration-200 group-hover:scale-110"
      />

      <span>{title}</span>

      {locked && (
        <span
          className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-400/15 dark:text-amber-300"
          title="Not in your plan. Upgrade to unlock."
        >
          <Lock size={10} aria-hidden="true" /> Upgrade
        </span>
      )}
    </NavLink>
  );
}