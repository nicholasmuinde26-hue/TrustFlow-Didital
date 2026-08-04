import Logo from "../Logo";
import SidebarSection from "./SidebarSection";

export default function Sidebar({ sections = [] }) {
  return (
    <aside
      className="
      hidden
      lg:flex
      w-72
      shrink-0
      flex-col
      border-r
      border-slate-200
      bg-white
      dark:border-slate-800
      dark:bg-slate-900
      "
    >
      {/* Logo */}

      <div className="border-b border-slate-200 p-6 dark:border-slate-800">
        <Logo />
      </div>

      {/* Navigation */}

      <nav
        className="
        flex-1
        overflow-y-auto
        px-4
        py-6
        space-y-8
        scrollbar-thin
        "
      >
        {sections.map((section) => (
          <SidebarSection
            key={section.title}
            {...section}
          />
        ))}
      </nav>

      {/* Footer */}

      <div
        className="
        border-t
        border-slate-200
        p-5
        dark:border-slate-800
        "
      >
        <div
          className="
          rounded-xl
          bg-gradient-to-r
          from-primary
          to-blue-700
          p-4
          text-white
          "
        >
          <p className="text-sm font-semibold">
            ChamaManager Pro
          </p>

          <p className="mt-1 text-xs text-blue-100">
            Manage multiple workspaces effortlessly.
          </p>
        </div>
      </div>
    </aside>
  );
}