import { useId } from "react";

import { cn } from "@/shared/utils/cn";

export default function Input({
  label,
  error,
  hint,
  id,
  className = "",
  ...props
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={inputId} className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {label}
        </label>
      )}

      <input
        id={inputId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        className={cn(
          "h-11 w-full rounded-[var(--radius-control)] border bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500",
          error ? "border-red-500 focus:border-red-600 focus:ring-red-500/20" : "border-slate-300 dark:border-slate-700",
          className
        )}
        {...props}
      />

      {hint && !error && (
        <p id={hintId} className="text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
