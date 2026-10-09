import { money } from "../../utils/overview";

// "KES" is set small and quiet so the amount itself carries the weight.
const splitMoney = (v) => {
  const s = money(v);
  const i = s.indexOf(" ");
  return [s.slice(0, i), s.slice(i + 1)];
};

// The one dark panel on the page: the headline balance, a small trend on the
// right, and a hairline-divided strip of supporting figures underneath.
export function BalanceHero({ label, icon: Icon, value, delta, caption, trend, children }) {
  const [currency, amount] = splitMoney(value);
  return (
    <section aria-label={label} className="relative overflow-hidden rounded-2xl border border-emerald-950/40 bg-[#0c2622] text-white shadow-sm dark:border-white/10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="@container relative">
        <div className="grid gap-5 p-5 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] @2xl:items-end @2xl:p-7">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-medium text-emerald-100/70">
              {Icon ? <Icon size={14} aria-hidden="true" /> : null}{label}
            </p>
            <p className="mt-2 flex items-baseline gap-2 tabular-nums">
              <span className="text-base font-medium text-white/50 sm:text-lg">{currency}</span>
              <span className="min-w-0 truncate text-3xl font-semibold tracking-tight sm:text-5xl">{amount}</span>
            </p>
            {delta ? <div className="mt-2">{delta}</div> : null}
            {caption ? <p className="mt-2 text-xs text-white/55">{caption}</p> : null}
          </div>
          {trend ? <div className="min-w-0">{trend}</div> : null}
        </div>
        <div className="border-t border-white/10 bg-black/15 px-5 py-2 @2xl:px-7">{children}</div>
      </div>
    </section>
  );
}
