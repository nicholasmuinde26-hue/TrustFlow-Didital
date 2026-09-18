const variants = {
  success:
    "bg-green-100 text-green-700 dark:bg-mint-deep dark:text-mint",

  warning:
    "bg-yellow-100 text-yellow-700 dark:bg-amber-deep-bg dark:text-amber-deep-text",

  danger:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",

  info:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",

  neutral:
    "bg-slate-100 text-slate-700 dark:bg-obsidian-raised dark:text-mist-muted",
};

export default function Badge({
  children,
  variant = "neutral",
}) {
  return (
    <span
      className={`
      inline-flex
      items-center
      rounded-full
      px-3
      py-1
      text-xs
      font-semibold
      ${variants[variant]}
      `}
    >
      {children}
    </span>
  );
}