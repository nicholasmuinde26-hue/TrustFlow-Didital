import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...inputs) => twMerge(clsx(inputs));

export const buttonVariants = ({
  variant = "primary",
  size = "md",
  fullWidth = false,
}) =>
  cn(
    "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none",

    {
      "bg-blue-600 hover:bg-blue-700 text-white":
        variant === "primary",

      "bg-slate-100 hover:bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-white":
        variant === "secondary",

      "bg-red-600 hover:bg-red-700 text-white":
        variant === "danger",

      "bg-green-600 hover:bg-green-700 text-white":
        variant === "success",

      "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800":
        variant === "ghost",
    },

    {
      "px-3 py-2 text-sm": size === "sm",

      "px-5 py-3": size === "md",

      "px-7 py-4 text-lg": size === "lg",
    },

    fullWidth && "w-full"
  );