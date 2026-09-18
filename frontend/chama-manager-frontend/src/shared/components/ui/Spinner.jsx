import { cn } from "@/shared/utils/cn";

const sizes = {
  sm: "h-4 w-4 border-2",
  md: "h-7 w-7 border-2",
  lg: "h-10 w-10 border-3",
};

export default function Spinner({ fullscreen = false, size = "md", label = "Loading" }) {
  const spinner = (
    <div className="flex items-center justify-center gap-3" role="status" aria-live="polite">
      <div className={cn("animate-spin rounded-full border-primary border-r-transparent", sizes[size] || sizes.md)} />
      <span className="sr-only">{label}</span>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm dark:bg-obsidian/80">
        {spinner}
      </div>
    );
  }

  return spinner;
}
