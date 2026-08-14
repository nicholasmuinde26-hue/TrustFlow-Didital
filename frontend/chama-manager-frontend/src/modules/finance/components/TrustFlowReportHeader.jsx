import React from "react";
import { ShieldCheck, Download, Printer, Sparkles, Building2, Users, Calendar } from "lucide-react";

export default function TrustFlowReportHeader({
  title,
  subtitle,
  mode, // 'CHAMA' | 'BUSINESS'
  onModeChange,
  asAtDate,
  onDateChange,
  onExportPdf,
  onExportExcel,
  workspaceName = "ChamaManager Workspace",
}) {
  const isChama = mode === "CHAMA";

  return (
    <header className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 p-6 sm:p-8 text-white shadow-xl space-y-6 print:border-none print:bg-white print:p-0 print:shadow-none print:text-black">
      {/* Top Brand Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/20 pb-5 print:border-b-2 print:border-black">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur print:hidden">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-wider uppercase text-emerald-100 print:text-black">
                TrustFlow Accounting Engine
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 border border-white/30 px-2.5 py-0.5 text-[10px] font-bold text-white print:hidden">
                <Sparkles className="h-3 w-3" /> VERIFIED
              </span>
            </div>
            <p className="text-xs text-emerald-100 print:text-slate-600">{workspaceName}</p>
          </div>
        </div>

        {/* Action Controls (Hidden on Print) */}
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          {/* Mode Switcher */}
          <div className="flex rounded-2xl border border-white/30 bg-black/20 p-1 backdrop-blur">
            <button
              type="button"
              onClick={() => onModeChange?.("CHAMA")}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                isChama
                  ? "bg-white text-emerald-900 shadow-md font-extrabold"
                  : "text-emerald-100 hover:text-white"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>CHAMA MODE</span>
            </button>
            <button
              type="button"
              onClick={() => onModeChange?.("BUSINESS")}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                !isChama
                  ? "bg-white text-sky-900 shadow-md font-extrabold"
                  : "text-emerald-100 hover:text-white"
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>BUSINESS MODE</span>
            </button>
          </div>

          {/* Date Picker */}
          {asAtDate && (
            <div className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-3 py-1.5 text-xs text-white backdrop-blur">
              <Calendar className="h-3.5 w-3.5 text-emerald-200" />
              <span>As at:</span>
              <input
                type="date"
                value={asAtDate}
                onChange={(e) => onDateChange?.(e.target.value)}
                className="bg-transparent text-white font-mono focus:outline-none"
              />
            </div>
          )}

          {/* Export Buttons */}
          <button
            type="button"
            onClick={onExportPdf || (() => window.print())}
            className="flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/10 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/20 transition"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>PDF / Print</span>
          </button>
          <button
            type="button"
            onClick={onExportExcel}
            className="flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-emerald-900 shadow-sm hover:bg-emerald-50 transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Excel / CSV</span>
          </button>
        </div>
      </div>

      {/* Main Title & Subtitle */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="inline-block rounded-full bg-white/20 border border-white/30 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white mb-1.5 print:border-black print:text-black">
            {isChama ? "MEMBER FINANCIAL STATEMENT — CHAMA MODE" : "IFRS / GAAP CORPORATE STATEMENT — BUSINESS MODE"}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight print:text-black">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-xs text-emerald-100 max-w-2xl print:text-slate-600">{subtitle}</p>
          )}
        </div>

        {/* Security Watermark Stamp */}
        <div className="rounded-2xl border border-white/30 bg-white/10 p-3 backdrop-blur text-right print:border-black print:bg-transparent">
          <span className="text-[10px] font-mono font-bold text-emerald-200 uppercase tracking-widest block print:text-slate-600">
            TRUSTFLOW AUDIT SEAL
          </span>
          <span className="text-xs font-mono font-extrabold text-white tracking-wider print:text-black">
            AUTHENTICATED & SIGNED
          </span>
        </div>
      </div>
    </header>
  );
}
