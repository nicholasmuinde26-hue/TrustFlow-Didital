import { X } from "lucide-react";
import Logo from "../Logo";
import SidebarSection from "./SidebarSection";
import AdminInquiryBottomPanel from "@/modules/workspaces/components/AdminInquiryBottomPanel";

export default function Sidebar({ sections = [], isOpen, onClose, workspace, workspaceId }) {
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

        {/* Footer — pinned to the bottom of the sidebar's own flex
            column (nav above is flex-1 + overflow-y-auto, so this
            never scrolls out of view). Admin & Support gets its own
            row, stacked above the promo card rather than squeezed
            beside it, the way help/support entries sit in most
            sidebar-based apps. */}
        <div
          className="
            border-t
            border-slate-200
            p-4
            dark:border-slate-800
            flex
            flex-col
            gap-3
          "
        >
          <AdminInquiryBottomPanel workspace={workspace} workspaceId={workspaceId} />

          
        </div>
      </aside>
    </>
  );
}