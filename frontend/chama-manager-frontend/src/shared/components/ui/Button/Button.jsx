import clsx from "clsx";

const variants = {
  primary:
    "bg-primary text-white hover:bg-primary/90",

  secondary:
    "bg-slate-100 hover:bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700",

  danger:
    "bg-red-600 text-white hover:bg-red-700",

  ghost:
    "hover:bg-slate-100 dark:hover:bg-slate-800",
};

const sizes = {
  sm: "h-9 px-3 text-sm",

  md: "h-11 px-5",

  lg: "h-12 px-6 text-base",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}