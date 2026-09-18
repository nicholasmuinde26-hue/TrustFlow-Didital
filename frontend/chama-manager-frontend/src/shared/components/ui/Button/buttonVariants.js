import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...inputs) => twMerge(clsx(inputs));

export const buttonVariants = ({
  variant = "primary",
  size = "md",
  fullWidth = false,
}) =>
  cn(
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold transition-colors duration-150 focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",

    {
      "bg-blue-600 hover:bg-blue-700 text-white dark:bg-mint dark:text-obsidian-rail dark:hover:bg-mint-hover":
        variant === "primary",

      "bg-slate-100 hover:bg-slate-200 text-slate-900 dark:bg-obsidian-raised dark:text-mist dark:hover:bg-obsidian-card":
        variant === "secondary",

      "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist dark:hover:bg-obsidian-raised":
        variant === "outline",

      "bg-red-600 hover:bg-red-700 text-white":
        variant === "danger",

      "bg-green-600 hover:bg-green-700 text-white dark:bg-mint dark:text-obsidian-rail dark:hover:bg-mint-hover":
        variant === "success",

      "bg-transparent text-slate-700 hover:bg-slate-100 dark:text-mist-muted dark:hover:bg-obsidian-raised":
        variant === "ghost",

      "h-auto bg-transparent px-0 py-0 text-blue-700 underline-offset-4 hover:underline dark:text-mint":
        variant === "link",
    },

    {
      "h-9 px-3 text-sm": size === "sm",

      "h-11 px-4 text-sm": size === "md",

      "h-12 px-6 text-base": size === "lg",
    },

    fullWidth && "w-full"
  );
