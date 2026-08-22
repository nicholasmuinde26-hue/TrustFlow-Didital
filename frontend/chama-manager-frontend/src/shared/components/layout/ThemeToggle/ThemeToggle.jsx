import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/app/providers/ThemeProvider";

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      className="
        relative
        flex
        h-11
        w-11
        items-center
        justify-center
        rounded-xl
        border
        border-slate-200
        bg-white
        text-slate-600
        shadow-sm
        transition-all
        duration-200

        hover:scale-105
        hover:border-slate-300
        hover:bg-slate-100
        hover:text-slate-900

        dark:border-slate-800
        dark:bg-slate-900
        dark:text-slate-300
        dark:hover:border-slate-700
        dark:hover:bg-slate-800
        dark:hover:text-white
      "
    >
      {isDark ? (
        <Sun size={19} className="text-amber-400 transition-transform duration-300 rotate-0 hover:rotate-45" />
      ) : (
        <Moon size={19} className="text-violet-600 transition-transform duration-300 rotate-0 hover:-rotate-12" />
      )}
    </button>
  );
}