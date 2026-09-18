import { forwardRef } from "react";

import { cn } from "@/shared/utils/cn";
import { buttonVariants } from "./buttonVariants";

const Button = forwardRef(function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  loadingLabel = "Loading",
  className,
  disabled,
  ...props
}, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        buttonVariants({ variant, size, fullWidth }),
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
          />
          <span>{loadingLabel}</span>
        </>
      ) : children}
    </button>
  );
});

export default Button;
