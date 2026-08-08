import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import SidebarItem from "./SidebarItem";

export default function SidebarSection({
  title,
  items,
  defaultOpen = false,
}) {
  const location = useLocation();

  const hasActiveItem = items.some((item) =>
    location.pathname.startsWith(item.to)
  );

  const isCollapsible = Boolean(title);

  const [open, setOpen] = useState(
    isCollapsible
      ? defaultOpen || hasActiveItem
      : true
  );

  useEffect(() => {
    if (isCollapsible && hasActiveItem) {
      setOpen(true);
    }
  }, [hasActiveItem, isCollapsible]);

  return (
    <section className="space-y-2">

      {/* Collapsible Header */}
      {isCollapsible && (
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="
            flex
            w-full
            items-center
            justify-between
            rounded-xl
            px-3
            py-2
            text-left
            transition
            hover:bg-slate-100
            dark:hover:bg-slate-800
          "
        >
          <div className="flex items-center gap-2">

            <span
              className="
                text-xs
                font-semibold
                uppercase
                tracking-wider
                text-slate-500
                dark:text-slate-400
              "
            >
              {title}
            </span>

            <span
              className="
                rounded-full
                bg-slate-200
                px-2
                py-0.5
                text-[10px]
                font-bold
                text-slate-600
                dark:bg-slate-700
                dark:text-slate-300
              "
            >
              {items.length}
            </span>

          </div>

          <ChevronRight
            size={16}
            className={`
              transition-transform duration-300
              ${open ? "rotate-90" : ""}
            `}
          />

        </button>
      )}

      {/* Navigation Items */}
      <div
        className={
          isCollapsible
            ? `
              overflow-hidden
              transition-all
              duration-300
              ${
                open
                  ? "max-h-[1000px] opacity-100"
                  : "max-h-0 opacity-0"
              }
            `
            : ""
        }
      >
        <div
          className={`space-y-1 ${
            isCollapsible ? "pl-2" : ""
          }`}
        >
          {items.map((item) => (
            <SidebarItem
              key={item.title}
              {...item}
            />
          ))}
        </div>
      </div>

    </section>
  );
}