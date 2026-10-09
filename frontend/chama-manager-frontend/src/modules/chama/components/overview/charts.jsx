import { useEffect, useId, useState } from "react";
import clsx from "clsx";
import { compact, money } from "../../utils/overview";
import { useElementWidth } from "./primitives";

const INCOME = "#10b981";
const EXPENSE = "#f43f5e";

// Round the axis to friendly steps (1, 2, 2.5, 5 x 10^n) so gridlines read cleanly.
function niceTicks(max, count = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const ticks = [];
  for (let v = 0; v <= max + step * 0.999; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

export function Sparkline({ values = [], className }) {
  const id = useId();
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 30 - ((v - min) / span) * 26]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className={clsx("w-full", className || "h-10")} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L100 32 L0 32 Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="#fff" strokeOpacity="0.9" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function ProgressBar({ value, label, tone = "emerald", className, track, size = "h-1.5" }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const fill = { emerald: "bg-emerald-500", amber: "bg-amber-500", rose: "bg-rose-500", sky: "bg-sky-500", light: "bg-emerald-300" }[tone];
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label}
      className={clsx("w-full overflow-hidden rounded-full", size, track || "bg-slate-100 dark:bg-obsidian-raised", className)}>
      <div className={clsx("h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none", fill)} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Ring({ value, size = 104, stroke = 10, color = INCOME, label, children }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${Math.round(v)}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-100 dark:stroke-obsidian-raised" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} className="transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function StackedBar({ segments, unit = "" }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  return (
    <div>
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-slate-100 dark:bg-obsidian-raised" role="img"
        aria-label={segments.map((s) => `${s.label} ${s.value}`).join(", ")}>
        {total > 0 && segments.filter((s) => s.value > 0).map((s) => (
          <div key={s.key || s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} className="h-full min-w-1 first:rounded-l-full last:rounded-r-full" />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs @lg:grid-cols-3">
        {segments.map((s) => (
          <li key={s.key || s.label} className="flex items-center justify-between gap-2 text-slate-500 dark:text-mist-muted">
            <span className="flex min-w-0 items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: s.color }} /><span className="truncate">{s.label}</span></span>
            <span className="font-semibold tabular-nums text-slate-900 dark:text-mist">{s.display ?? `${s.value}${unit}`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Grouped weekly bars (income vs expenses). Sized from the real container
// width, so labels stay legible on a 360px phone. Tap or hover a week for
// exact figures; a hidden table mirrors the data for screen readers.
export function CashFlowChart({ weeks, height = 210 }) {
  const [ref, width] = useElementWidth();
  const [active, setActive] = useState(null);
  // On touch there is no mouse-leave: tapping anywhere outside the chart dismisses the tooltip.
  useEffect(() => {
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setActive(null); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [ref]);
  const pad = { l: 40, r: 6, t: 10, b: 24 };
  const innerW = Math.max(0, width - pad.l - pad.r);
  const innerH = height - pad.t - pad.b;
  const max = Math.max(...weeks.map((w) => Math.max(w.income, w.expense)), 0);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const y = (v) => pad.t + innerH - (Math.max(0, v) / top) * innerH;
  const band = weeks.length ? innerW / weeks.length : 0;
  const barW = Math.max(4, Math.min(16, band * 0.26));
  const cur = active != null ? weeks[active] : null;
  const tipX = active != null ? Math.min(Math.max(pad.l + band * (active + 0.5), 70), Math.max(70, width - 70)) : 0;

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setActive(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={`Income versus expenses for the last ${weeks.length} weeks`} className="block">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} strokeDasharray={t === 0 ? undefined : "2 4"} className={t === 0 ? "stroke-slate-300 dark:stroke-obsidian-border" : "stroke-slate-100 dark:stroke-obsidian-raised"} />
              <text x={pad.l - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" className="fill-slate-400 tabular-nums">{compact(t)}</text>
            </g>
          ))}
          {weeks.map((w, i) => {
            const cx = pad.l + band * (i + 0.5);
            return (
              <g key={w.label || i} opacity={active == null || active === i ? 1 : 0.45}>
                <rect x={cx - barW - 1} y={y(w.income)} width={barW} height={Math.max(0, pad.t + innerH - y(w.income))} rx="2" fill={INCOME} />
                <rect x={cx + 1} y={y(w.expense)} width={barW} height={Math.max(0, pad.t + innerH - y(w.expense))} rx="2" fill={EXPENSE} />
                <text x={cx} y={height - 7} textAnchor="middle" fontSize="10" className="fill-slate-400">{w.label}</text>
                <rect x={pad.l + band * i} y={pad.t} width={band} height={innerH + pad.b} fill="transparent" tabIndex={0}
                  onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
                  onClick={() => setActive(i)} aria-label={`${w.label}: income ${money(w.income)}, expenses ${money(w.expense)}`} />
              </g>
            );
          })}
        </svg>
      )}
      {cur && (
        <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-obsidian-border dark:bg-obsidian-raised" style={{ left: tipX }}>
          <p className="mb-1 font-semibold text-slate-900 dark:text-mist">{cur.label}</p>
          <p className="flex items-center gap-1.5 whitespace-nowrap text-slate-600 dark:text-mist-muted"><span className="h-2 w-2 rounded-full bg-emerald-500" />Income <b className="ml-auto pl-3 font-semibold tabular-nums text-slate-900 dark:text-mist">{money(cur.income)}</b></p>
          <p className="flex items-center gap-1.5 whitespace-nowrap text-slate-600 dark:text-mist-muted"><span className="h-2 w-2 rounded-full bg-rose-500" />Expenses <b className="ml-auto pl-3 font-semibold tabular-nums text-slate-900 dark:text-mist">{money(cur.expense)}</b></p>
        </div>
      )}
      <table className="sr-only">
        <caption>Weekly income and expenses</caption>
        <thead><tr><th>Week</th><th>Income</th><th>Expenses</th></tr></thead>
        <tbody>{weeks.map((w, i) => <tr key={w.label || i}><td>{w.label}</td><td>{money(w.income)}</td><td>{money(w.expense)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}