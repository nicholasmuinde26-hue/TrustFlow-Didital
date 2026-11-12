import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export default function Dialog({ open, onClose, title, description, icon: Icon, children, footer, size = "md" }) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    const focusable = () => panelRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
    requestAnimationFrame(() => {
      const firstField = panelRef.current?.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
      (firstField || focusable()?.[0] || panelRef.current)?.focus?.();
    });
    const closeOnEscape = (event) => {
      if (event.key === "Escape") closeRef.current?.();
      if (event.key === "Tab") {
        const elements = Array.from(focusable() || []);
        if (!elements.length) { event.preventDefault(); panelRef.current?.focus(); return; }
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [open]);

  const width = size === "lg" ? "max-w-2xl" : size === "sm" ? "max-w-md" : "max-w-xl";

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button type="button" className="absolute inset-0 cursor-default bg-slate-950/55 backdrop-blur-sm" onClick={onClose} aria-label="Close dialog" />
          <motion.section
            ref={panelRef} tabIndex={-1}
            role="dialog" aria-modal="true" aria-labelledby="shared-dialog-title" aria-describedby={description ? "shared-dialog-description" : undefined}
            initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.18, ease: "easeOut" }}
            className={`relative flex max-h-[min(90vh,800px)] w-full ${width} flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_90px_-25px_rgba(15,23,42,0.55)] dark:border-obsidian-border dark:bg-obsidian-card`}
          >
            <header className="flex items-start gap-3 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white px-5 py-4 sm:px-6 dark:border-obsidian-border dark:from-obsidian-raised/70 dark:to-obsidian-card">
              {Icon && <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-mint-deep/40 dark:text-mint dark:ring-mint/10"><Icon size={19} /></div>}
              <div className="min-w-0 flex-1 pt-0.5">
                <h2 id="shared-dialog-title" className="text-base font-black tracking-tight text-slate-900 dark:text-mist">{title}</h2>
                {description && <p id="shared-dialog-description" className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-mist-muted">{description}</p>}
              </div>
              <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-obsidian-raised dark:hover:text-mist" aria-label="Close dialog"><X size={17} /></button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
            {footer && <footer className="border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-6 dark:border-obsidian-border dark:bg-obsidian-raised/40">{footer}</footer>}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
