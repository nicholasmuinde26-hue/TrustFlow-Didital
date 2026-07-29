import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/app/providers/ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="
        flex
        h-11
        w-11
        items-center
        justify-center
        rounded-xl
        border
        border-slate-200
        bg-white
        transition-all
        duration-200

        hover:scale-105
        hover:bg-slate-100

        dark:border-slate-700
        dark:bg-slate-800
        dark:hover:bg-slate-700
      "
    >
      {theme === "dark" ? (
        <Sun
          size={20}
          className="text-yellow-400"
        />
      ) : (
        <Moon
          size={20}
          className="text-slate-700"
        />
      )}
    </button>
  );
}