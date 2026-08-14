import { X } from "lucide-react";
import Logo from "../Logo";
import SidebarSection from "./SidebarSection";

export default function Sidebar({ sections = [], isOpen, onClose }) {
  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <div
        className={`
          fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden
          ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
        `}
        onClick={onClose}
      />

      <aside
        className={`
          fixed top-0 bottom-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-300 dark:border-slate-800 dark:bg-slate-900
          lg:static lg:z-0 lg:translate-x-0 lg:flex
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo & Close Button */}
        <div className="flex items-center justify-between border-b border-slate-200 p-6 dark:border-slate-800">
          <Logo />

          <button
            type="button"
            onClick={onClose}
            className="
              rounded-lg
              p-1.5
              text-slate-500
              hover:bg-slate-100
              dark:text-slate-400
              dark:hover:bg-slate-800
              lg:hidden
            "
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav
          onClick={(e) => {
            if (e.target.closest("a")) {
              onClose?.();
            }
          }}
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
            <SidebarSection key={section.title} {...section} />
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
            <p className="text-sm font-semibold">VeriCircle Pro</p>

            <p className="mt-1 text-xs text-blue-100">
              Manage multiple workspaces effortlessly.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}