import { cn } from "@/shared/utils/cn";

export default function Card({
  children,
  className = "",
  as: Component = "section",
}) {
  return (
    <Component
      className={cn(
        "rounded-[var(--radius-panel)] border border-slate-200 bg-white shadow-[var(--shadow-panel)] dark:border-obsidian-border dark:bg-obsidian-card",
        className
      )}
    >
      {children}
    </Component>
  );
}
