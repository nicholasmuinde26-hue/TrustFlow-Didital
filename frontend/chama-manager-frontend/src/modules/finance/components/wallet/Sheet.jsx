import React, { useEffect } from "react";
import { X } from "lucide-react";

// Bottom sheet on phones, centred dialog on larger screens.
export default function Sheet({ title, onClose, children, locked = false }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && !locked) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, locked]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => !locked && onClose()} />
      <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl dark:bg-obsidian-card sm:max-w-md sm:rounded-3xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900 dark:text-mist">{title}</h3>
          {!locked && (
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-obsidian-raised">
              <X size={18} />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
