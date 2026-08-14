import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ShieldAlert, Info, X, Loader2 } from "lucide-react";

export default function CautionModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Sensitive Action",
  description = "Are you sure you want to proceed? This action may have permanent effects.",
  confirmText = "Yes, Proceed",
  cancelText = "Cancel",
  type = "warning", // 'danger' | 'warning' | 'info'
  details = [],
  busy = false,
}) {
  if (!isOpen) return null;

  const typeConfig = {
    danger: {
      bgIcon: "bg-red-500/10 text-red-500 border-red-500/20",
      badgeBg: "bg-red-500/10 text-red-400 border-red-500/30",
      buttonBg: "bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white shadow-lg shadow-red-900/30",
      accentBorder: "border-red-500/30",
      icon: ShieldAlert,
      tag: "HIGH RISK ACTION",
    },
    warning: {
      bgIcon: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      badgeBg: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      buttonBg: "bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white shadow-lg shadow-amber-900/30",
      accentBorder: "border-amber-500/30",
      icon: AlertTriangle,
      tag: "CAUTION REQUIRED",
    },
    info: {
      bgIcon: "bg-sky-500/10 text-sky-500 border-sky-500/20",
      badgeBg: "bg-sky-500/10 text-sky-400 border-sky-500/30",
      buttonBg: "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-900/30",
      accentBorder: "border-sky-500/30",
      icon: Info,
      tag: "CONFIRMATION NEEDED",
    },
  };

  const config = typeConfig[type] || typeConfig.warning;
  const IconComponent = config.icon;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={!busy ? onClose : undefined}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", duration: 0.3 }}
          className={`relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border ${config.accentBorder} bg-slate-900 p-6 text-slate-100 shadow-2xl ring-1 ring-white/10`}
        >
          {/* Header Bar Accent */}
          <div className={`absolute top-0 left-0 right-0 h-1.5 ${type === 'danger' ? 'bg-gradient-to-r from-red-500 via-rose-500 to-amber-500' : type === 'warning' ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-400' : 'bg-gradient-to-r from-sky-500 via-teal-400 to-emerald-400'}`} />

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${config.bgIcon}`}>
                <IconComponent className="h-6 w-6" />
              </div>
              <div>
                <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wider ${config.badgeBg}`}>
                  {config.tag}
                </span>
                <h3 className="text-xl font-bold tracking-tight text-white mt-1">
                  {title}
                </h3>
              </div>
            </div>
            {!busy && (
              <button
                onClick={onClose}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            {description}
          </p>

          {/* Key-Value Details Breakdown */}
          {details.length > 0 && (
            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
              {details.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">{item.label}</span>
                  <span className="font-semibold text-slate-100 bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-700/50">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className={`flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-50 ${config.buttonBg}`}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>{confirmText}</span>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
