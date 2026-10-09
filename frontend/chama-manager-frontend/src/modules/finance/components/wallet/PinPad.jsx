import React, { useEffect } from "react";
import { Delete } from "lucide-react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

export default function PinPad({ value, onChange, onSubmit, max = 6, disabled = false }) {
  useEffect(() => {
    const handler = (event) => {
      if (disabled) return;
      if (/^\d$/.test(event.key)) onChange((value + event.key).slice(0, max));
      else if (event.key === "Backspace") onChange(value.slice(0, -1));
      else if (event.key === "Enter" && value.length >= 4) onSubmit?.();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [value, onChange, onSubmit, max, disabled]);

  const slots = Math.max(4, value.length);

  return (
    <div>
      <div className="mb-6 flex justify-center gap-3" aria-label={`${value.length} digits entered`}>
        {Array.from({ length: slots }).map((_, index) => (
          <span
            key={index}
            className={`h-3.5 w-3.5 rounded-full border-2 transition ${
              index < value.length ? "border-emerald-600 bg-emerald-600" : "border-slate-300 dark:border-obsidian-border"
            }`}
          />
        ))}
      </div>
      <div className="mx-auto grid max-w-[16rem] grid-cols-3 gap-3">
        {KEYS.map((key, index) =>
          key === "" ? (
            <span key={index} />
          ) : (
            <button
              key={index}
              type="button"
              disabled={disabled}
              onClick={() => onChange(key === "back" ? value.slice(0, -1) : (value + key).slice(0, max))}
              aria-label={key === "back" ? "Delete" : key}
              className="flex h-14 items-center justify-center rounded-2xl bg-slate-100 text-xl font-bold text-slate-800 transition active:scale-95 hover:bg-slate-200 disabled:opacity-50 dark:bg-obsidian-raised dark:text-mist dark:hover:bg-obsidian-border"
            >
              {key === "back" ? <Delete size={20} /> : key}
            </button>
          )
        )}
      </div>
    </div>
  );
}
