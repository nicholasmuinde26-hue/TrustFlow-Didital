import React, { useEffect, useRef, useState } from "react";
import { X, CheckCircle2, Clock, AlertTriangle, CircleDashed, MinusCircle } from "lucide-react";

// ============================================================
// PRO KIT: small shared pieces for the Contributions and Money
// (Treasury) pages. Colours come from the app's existing tokens
// (emerald / violet in light, obsidian / mint in dark).
// ============================================================

export const DAY_MS = 86_400_000;

// ---------- formatting ----------
export const fmt = (n) =>
  Number(n || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 });
export const fmtExact = (n) =>
  Number(n || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const shortDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-KE", { day: "2-digit", month: "short" }) : "—";
export const longDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const clock = (d) =>
  d ? new Date(d).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }) : "";

// ---------- status chips ----------
const CHIP = {
  paid: ["bg-emerald-100 text-emerald-800 dark:bg-mint-deep dark:text-mint", CheckCircle2, "Paid"],
  pending: ["bg-amber-100 text-amber-800 dark:bg-amber-deep-bg dark:text-amber-deep-text", Clock, "Pending"],
  arrears: ["bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300", AlertTriangle, "Arrears"],
  partial: ["bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300", CircleDashed, "Partial"],
  excused: ["bg-slate-100 text-slate-600 dark:bg-obsidian-raised dark:text-mist-muted", MinusCircle, "Excused"],
};

export function StatusChip({ status, label }) {
  const [cls, Icon, text] = CHIP[status] || CHIP.pending;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${cls}`}>
      <Icon size={12} aria-hidden /> {label || text}
    </span>
  );
}

// Marks anything that has no backend source yet. Flip SHOW_SAMPLE in
// financeSample.js to hide every sample-backed block at once.
export function SampleTag({ children = "Sample data", title }) {
  return (
    <span
      title={title || "No backend source for this yet. Values are illustrative."}
      className="inline-flex items-center rounded-md border border-dashed border-slate-300 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-obsidian-border dark:text-mist-muted"
    >
      {children}
    </span>
  );
}

// ---------- ring ----------
export function Ring({ value = 0, size = 112, stroke = 10, tone = "emerald", children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const color = { emerald: "#10b981", amber: "#f59e0b", rose: "#f43f5e" }[tone];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${Math.round(v)} percent`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-200 dark:stroke-obsidian-raised" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          stroke={color} strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)}
          style={{ transition: "stroke-dashoffset .6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

// ---------- segmented bar (wallet split, etc.) ----------
export function SegBar({ parts, height = 10 }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div
      className="flex w-full overflow-hidden rounded-full bg-slate-100 dark:bg-obsidian-raised"
      style={{ height }}
      role="img"
      aria-label={parts.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(", ")}
    >
      {parts.map((p) => (
        <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={p.label} />
      ))}
    </div>
  );
}

// ---------- two-line chart (income vs expenses) ----------
export function DualLineChart({ labels, income, expense, height = 170 }) {
  const W = 560, H = height, padL = 44, padR = 12, padT = 12, padB = 24;
  const max = Math.max(1, ...income, ...expense) * 1.1;
  const x = (i) => padL + (i * (W - padL - padR)) / Math.max(1, labels.length - 1);
  const y = (v) => padT + (1 - v / max) * (H - padT - padB);
  const path = (arr) => arr.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const ticks = [0, 0.5, 1].map((t) => t * max);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Income versus expenses by month">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="stroke-slate-100 dark:stroke-obsidian-border" />
          <text x={padL - 6} y={y(t) + 3} textAnchor="end" className="fill-slate-400 text-[10px]">
            {t >= 1000 ? `${Math.round(t / 1000)}k` : Math.round(t)}
          </text>
        </g>
      ))}
      <path d={`${path(income)} L${x(income.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill="#10b981" opacity=".08" />
      <path d={path(income)} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={path(expense)} fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 4" />
      {labels.map((l, i) => (
        <text key={l + i} x={x(i)} y={H - 6} textAnchor="middle" className="fill-slate-400 text-[10px]">{l}</text>
      ))}
      <circle cx={x(income.length - 1)} cy={y(income[income.length - 1])} r="3.5" fill="#10b981" />
      <circle cx={x(expense.length - 1)} cy={y(expense[expense.length - 1])} r="3.5" fill="#f43f5e" />
    </svg>
  );
}

// ---------- tabs ----------
export function Tabs({ tabs, value, onChange, className = "" }) {
  return (
    <div role="tablist" className={`flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-obsidian-border ${className}`}>
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.key)}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-violet-500 ${
              on
                ? "border-emerald-600 text-slate-900 dark:border-mint dark:text-mist"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-mist-muted dark:hover:text-mist"
            }`}
          >
            {t.label}
            {t.count != null && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  t.alert
                    ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                    : "bg-slate-100 text-slate-500 dark:bg-obsidian-raised dark:text-mist-muted"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------- drawer + modal ----------
function useEsc(open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
}

export function Drawer({ open, onClose, title, subtitle, children, footer }) {
  useEsc(open, onClose);
  const ref = useRef(null);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl outline-none dark:bg-obsidian-card"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-obsidian-border">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-mist">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-mist-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-obsidian-raised">
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="border-t border-slate-100 px-5 py-3 dark:border-obsidian-border">{footer}</footer>}
      </aside>
    </div>
  );
}

export function Modal({ open, onClose, title, subtitle, children, wide }) {
  useEsc(open, onClose);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-obsidian-card ${wide ? "max-w-2xl" : "max-w-md"}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-mist">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-mist-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-obsidian-raised">
            <X size={16} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

// ---------- form bits ----------
export const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist dark:focus:border-mint";
export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:opacity-50 dark:bg-mint dark:text-mint-strong dark:hover:bg-mint-hover";
export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist dark:hover:bg-obsidian-raised";

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-emerald-600 dark:bg-mint" : "bg-slate-300 dark:bg-obsidian-raised"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all dark:bg-obsidian ${checked ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

// ---------- hooks ----------
export function useOnline() {
  const [on, setOn] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOn(true);
    const down = () => setOn(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return on;
}

export function useTicker(ms = 1000) {
  const [t, setT] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setT(Date.now()), ms);
    return () => clearInterval(i);
  }, [ms]);
  return t;
}

export function usePersisted(key, initial) {
  const [v, setV] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* storage may be unavailable */
    }
  }, [key, v]);
  return [v, setV];
}

// ---------- exports & documents ----------
export function downloadCsv(filename, rows) {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = rows.map((r) => r.map(q).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + body], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Opens a print-ready receipt or statement. "Save as PDF" in the print
// dialog produces the PDF, so no PDF library is needed.
export function printDocument({ title, group, rows, total, meta = [], signer, kind = "Receipt" }) {
  const w = window.open("", "_blank", "width=720,height=900");
  if (!w) return false;
  const initials = (group || "G").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
 *{box-sizing:border-box} body{font:13px/1.5 system-ui,sans-serif;color:#0f172a;margin:0;padding:40px}
 .top{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #047857;padding-bottom:16px}
 .logo{display:flex;align-items:center;gap:12px;font-weight:700;font-size:16px}
 .mark{width:40px;height:40px;border-radius:10px;background:#047857;color:#fff;display:grid;place-items:center;font-weight:800}
 h1{font-size:13px;margin:0;color:#475569;font-weight:600}
 .meta{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 24px;margin:20px 0}
 .meta span{color:#64748b;display:block;font-size:11px}
 table{width:100%;border-collapse:collapse;margin-top:8px}
 th,td{padding:9px 6px;border-bottom:1px solid #e2e8f0;text-align:left}
 th{font-size:11px;color:#64748b;font-weight:600} td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
 .total{display:flex;justify-content:space-between;font-weight:700;font-size:16px;margin-top:16px}
 .sign{margin-top:56px;display:flex;justify-content:space-between;color:#475569}
 .sign div{border-top:1px solid #94a3b8;padding-top:6px;min-width:200px}
 .foot{margin-top:32px;font-size:10px;color:#94a3b8}
 @media print{body{padding:16px}}
</style></head><body>
<div class="top"><div class="logo"><div class="mark">${esc(initials)}</div><div>${esc(group)}</div></div><h1>${esc(kind)}</h1></div>
<div class="meta">${meta.map(([k, v]) => `<div><span>${esc(k)}</span>${esc(v)}</div>`).join("")}</div>
<table><thead><tr>${rows[0].map((h, i) => `<th class="${i === rows[0].length - 1 ? "n" : ""}">${esc(h)}</th>`).join("")}</tr></thead>
<tbody>${rows.slice(1).map((r) => `<tr>${r.map((c, i) => `<td class="${i === r.length - 1 ? "n" : ""}">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>
${total ? `<div class="total"><span>${esc(total[0])}</span><span>${esc(total[1])}</span></div>` : ""}
<div class="sign"><div>${esc(signer || "Treasurer")}<br><small>Treasurer signature</small></div><div>${new Date().toLocaleString("en-KE")}<br><small>Issued</small></div></div>
<p class="foot">Generated from the group's ledger. Every amount traces to an M-Pesa, bank or cash reference.</p>
<script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>`);
  w.document.close();
  return true;
}

export const phoneIntl = (p) => {
  let c = String(p || "").replace(/\D/g, "");
  if (!c) return "";
  if (c.startsWith("0")) c = "254" + c.slice(1);
  else if (c.startsWith("7") || c.startsWith("1")) c = "254" + c;
  return c;
};
export const waLink = (phone, text) => `https://wa.me/${phoneIntl(phone)}?text=${encodeURIComponent(text)}`;
export const smsLink = (phone, text) => `sms:+${phoneIntl(phone)}?body=${encodeURIComponent(text)}`;