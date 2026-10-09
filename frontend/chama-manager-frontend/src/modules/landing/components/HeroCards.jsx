import { BadgeCheck, CheckCircle2, Link2, Receipt, Smartphone } from "lucide-react";

import BrandMark from "@/shared/components/layout/BrandMark";
import { useCountUp } from "../hooks";

/* Right-hand "product" cards for each hero slide. `active` restarts their
   entrance animations every time their slide comes back round. */

const shell =
  "relative overflow-hidden rounded-3xl border border-white/15 bg-obsidian-card/70 shadow-2xl shadow-black/40 backdrop-blur-xl";

const rise = (active, d) => ({
  className: active ? "lp-rise" : "opacity-0",
  style: { "--d": `${d}ms` },
});

function Sample() {
  return (
    <p className="mt-3 text-center text-[10px] uppercase tracking-widest text-mist-muted/70">
      Sample data for illustration
    </p>
  );
}

/* ---------------------------------------------------------- 1 · Chama */
export function ChamaCard({ active }) {
  const treasury = useCountUp(482300, active, 1600);
  const collected = useCountUp(96000, active, 1600);
  const loans = useCountUp(7, active, 900);
  const fmt = (n) => `KES ${n.toLocaleString("en-KE")}`;

  const rows = [
    ["Wanjiku M.", "Monthly dues", "KES 2,000", "Paid"],
    ["Otieno K.", "MGR contribution", "KES 1,500", "Paid"],
    ["Amina S.", "Welfare", "KES 500", "Due"],
    ["Kamau P.", "Monthly dues", "KES 2,000", "Paid"],
  ];

  return (
    <div className="relative">
      <div className={`absolute -right-3 -top-5 z-10 hidden xl:block ${active ? "lp-pop-in" : "opacity-0"}`} style={{ "--d": "900ms" }}>
        <div className="lp-float flex items-center gap-2.5 rounded-2xl border border-white/15 bg-obsidian-raised/75 px-3.5 py-2.5 shadow-xl backdrop-blur-xl">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-mint/15 text-mint">
            <span className="lp-ping absolute inset-0 rounded-full bg-mint/40" />
            <Smartphone size={14} className="relative" />
          </span>
          <div>
            <p className="text-[11px] font-bold text-white">M-Pesa payment received</p>
            <p className="text-[10px] text-mist-muted">KES 2,000 · matched to Wanjiku M.</p>
          </div>
        </div>
      </div>

      <div className={shell}>
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <BrandMark size={28} title="" />
            <div>
              <p className="text-sm font-bold text-white">Upper Kyati Women's Group</p>
              <p className="text-[11px] text-mist-muted">Chama overview</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-mint/10 px-2.5 py-1 text-[11px] font-semibold text-mint">
            <span className="relative flex h-1.5 w-1.5">
              <span className="lp-ping absolute inset-0 rounded-full bg-mint" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-mint" />
            </span>
            Ledger balanced
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 p-5">
          {[
            ["Treasury", fmt(treasury)],
            ["Collected this month", fmt(collected)],
            ["Active loans", String(loans)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/5 bg-obsidian-raised/55 p-3.5 backdrop-blur-md">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-mist-muted">{label}</p>
              <p className="mt-1.5 text-sm font-black tabular-nums text-white sm:text-lg">{value}</p>
            </div>
          ))}
        </div>

        <div className="px-5">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-mist">June contributions</span>
            <span className="font-bold text-mint">87%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-obsidian-raised/45">
            <div
              className="h-full rounded-full bg-gradient-to-r from-mint-hover to-mint transition-[width] duration-[1600ms] ease-out"
              style={{ width: active ? "87%" : "0%" }}
            />
          </div>
        </div>

        <div className="p-5">
          <div className="divide-y divide-white/10 rounded-2xl border border-white/5 bg-obsidian-raised/55 backdrop-blur-md">
            {rows.map(([name, plan, amount, status], i) => (
              <div key={name} {...rise(active, 500 + i * 130)} className={`${rise(active, 0).className} flex items-center justify-between gap-3 px-4 py-3`}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{name}</p>
                  <p className="truncate text-[11px] text-mist-muted">{plan}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-bold text-mist">{amount}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status === "Paid" ? "bg-mint/15 text-mint" : "bg-amber-400/15 text-amber-300"}`}>
                    {status}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <Sample />
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------- 2 · Collections */
export function CollectionsCard({ active }) {
  const steps = [
    ["STK push sent", "Wanjiku M. · Monthly dues"],
    ["Payment confirmed", "KES 2,000 received"],
    ["Matched & posted", "Dr Cash · Cr Member contributions"],
  ];
  const today = useCountUp(24500, active, 1400);

  return (
    <div className={`${shell} !bg-obsidian-card/70 !backdrop-blur-sm`}>
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint/15 text-mint">
            <Smartphone size={18} />
          </span>
          <div>
            <p className="text-sm font-bold text-white">Collections</p>
            <p className="text-[11px] text-mist-muted">M-Pesa STK push</p>
          </div>
        </div>
        <span className="rounded-full bg-sky-400/10 px-2.5 py-1 text-[11px] font-semibold text-sky-300">Auto-matched</span>
      </div>

      <ol className="space-y-1 p-5">
        {steps.map(([title, text], i) => (
          <li key={title} {...rise(active, 300 + i * 260)} className={`${rise(active, 0).className} relative flex gap-4 pb-5 last:pb-0`}>
            {i < steps.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-mint/25" aria-hidden />}
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mint text-obsidian">
              <CheckCircle2 size={17} />
            </span>
            <div>
              <p className="text-sm font-bold text-white">{title}</p>
              <p className="text-xs text-mist-muted">{text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mx-5 mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-obsidian-raised/55 p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-mist-muted">Today</p>
          <p className="mt-1 text-lg font-black tabular-nums text-white">KES {today.toLocaleString("en-KE")}</p>
        </div>
        <div className="rounded-2xl bg-obsidian-raised/55 p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-mist-muted">Unmatched</p>
          <p className="mt-1 text-lg font-black text-mint">0</p>
        </div>
      </div>
      <div className="px-5 pb-5">
        <Sample />
      </div>
    </div>
  );
}

/* ------------------------------------------------------ 3 · Business */
export function BusinessCard({ active }) {
  const items = [
    ["Maize flour 2kg × 2", "KES 280"],
    ["Cooking oil 1L × 1", "KES 320"],
    ["Sugar 1kg × 3", "KES 540"],
  ];
  const total = useCountUp(1140, active, 1200);

  return (
    <div className={shell}>
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400/15 text-violet-300">
            <Receipt size={18} />
          </span>
          <div>
            <p className="text-sm font-bold text-white">Point of sale</p>
            <p className="text-[11px] text-mist-muted">Receipt #1042</p>
          </div>
        </div>
        <span className="rounded-full bg-mint/10 px-2.5 py-1 text-[11px] font-semibold text-mint">Shift open</span>
      </div>

      <div className="p-5">
        <div className="divide-y divide-dashed divide-white/10 rounded-2xl border border-white/5 bg-obsidian-raised/55 backdrop-blur-md">
          {items.map(([name, price], i) => (
            <div key={name} {...rise(active, 300 + i * 200)} className={`${rise(active, 0).className} flex items-center justify-between px-4 py-3 text-sm`}>
              <span className="text-mist">{name}</span>
              <span className="font-bold tabular-nums text-white">{price}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-4">
            <span className="text-sm font-semibold text-mist-muted">Total</span>
            <span className="text-2xl font-black tabular-nums text-mint">KES {total.toLocaleString("en-KE")}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div {...rise(active, 1000)} className={`${rise(active, 0).className} rounded-2xl border border-white/5 bg-obsidian-raised/55 p-3.5 backdrop-blur-md`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-mist-muted">Paid with</p>
            <p className="mt-1 text-sm font-bold text-white">M-Pesa</p>
          </div>
          <div {...rise(active, 1150)} className={`${rise(active, 0).className} rounded-2xl border border-white/5 bg-obsidian-raised/55 p-3.5 backdrop-blur-md`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-mist-muted">Stock</p>
            <p className="mt-1 text-sm font-bold text-white">3 items updated</p>
          </div>
        </div>
        <Sample />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- 4 · Trust */
export function TrustCard({ active }) {
  const events = [
    ["Loan #L-014 approved", "Treasurer", "9f3a…c1"],
    ["Contribution posted", "Wanjiku M.", "b72e…04"],
    ["Payout scheduled", "Merry-go-round", "5d1c…ae"],
    ["Role changed", "Secretary", "e08b…77"],
  ];
  return (
    <div className={shell}>
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint/15 text-mint">
            <Link2 size={18} />
          </span>
          <div>
            <p className="text-sm font-bold text-white">Audit trail</p>
            <p className="text-[11px] text-mist-muted">Every action, chained</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-mint/10 px-2.5 py-1 text-[11px] font-semibold text-mint">
          <BadgeCheck size={13} />
          Chain intact
        </span>
      </div>

      <ul className="space-y-2 p-5">
        {events.map(([title, who, hash], i) => (
          <li key={hash} {...rise(active, 300 + i * 200)} className={`${rise(active, 0).className} flex items-center justify-between gap-3 rounded-2xl bg-obsidian-raised px-4 py-3`}>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{title}</p>
              <p className="text-[11px] text-mist-muted">{who}</p>
            </div>
            <code className="shrink-0 rounded-md bg-black/30 px-2 py-1 font-mono text-[11px] text-mint">{hash}</code>
          </li>
        ))}
      </ul>
      <div className="px-5 pb-5">
        <Sample />
      </div>
    </div>
  );
}
